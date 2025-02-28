import * as React from 'react';
import {InjectedRouter} from 'react-router';
import {withTheme} from '@emotion/react';
import {EChartOption} from 'echarts/lib/echarts';
import {Query} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import ChartZoom, {ZoomRenderProps} from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {
  getInterval,
  processTableResults,
  RELEASE_LINES_THRESHOLD,
} from 'app/components/charts/utils';
import WorldMapChart from 'app/components/charts/worldMapChart';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {DateString, OrganizationSummary} from 'app/types';
import {Series} from 'app/types/echarts';
import {defined} from 'app/utils';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import {TableDataWithTitle} from 'app/utils/discover/discoverQuery';
import {aggregateMultiPlotType, getEquation, isEquation} from 'app/utils/discover/fields';
import {decodeList} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';

import EventsGeoRequest from './eventsGeoRequest';
import EventsRequest from './eventsRequest';

type ChartComponent =
  | React.ComponentType<BarChart['props']>
  | React.ComponentType<AreaChart['props']>
  | React.ComponentType<LineChart['props']>
  | React.ComponentType<React.ComponentProps<typeof WorldMapChart>>;

type ChartProps = {
  theme: Theme;
  loading: boolean;
  reloading: boolean;
  zoomRenderProps: ZoomRenderProps;
  tableData: TableDataWithTitle[];
  timeseriesData: Series[];
  showLegend?: boolean;
  minutesThresholdToDisplaySeconds?: number;
  legendOptions?: EChartOption.Legend;
  chartOptions?: Omit<EChartOption, 'xAxis' | 'yAxis'> & {
    xAxis?: EChartOption.XAxis;
    yAxis?: EChartOption.YAxis;
  };
  currentSeriesNames: string[];
  releaseSeries?: Series[];
  previousSeriesNames: string[];
  previousTimeseriesData?: Series[] | null;
  /**
   * A callback to allow for post-processing of the series data.
   * Can be used to rename series or even insert a new series.
   */
  seriesTransformer?: (series: Series[]) => Series[];
  previousSeriesTransformer?: (series?: Series | null) => Series | null | undefined;
  showDaily?: boolean;
  interval?: string;
  yAxis: string;
  stacked: boolean;
  colors?: string[];
  /**
   * By default, only the release series is disableable. This adds
   * a list of series names that are also disableable.
   */
  disableableSeries?: string[];
  chartComponent?: ChartComponent;
  height?: number;
  timeframe?: {start: number; end: number};
  topEvents?: number;
  referrer?: string;
  fromDiscover?: boolean;
};

type State = {
  seriesSelection: Record<string, boolean>;
  forceUpdate: boolean;
};

class Chart extends React.Component<ChartProps, State> {
  state: State = {
    seriesSelection: {},
    forceUpdate: false,
  };

  shouldComponentUpdate(nextProps: ChartProps, nextState: State) {
    if (nextState.forceUpdate) {
      return true;
    }

    if (!isEqual(this.state.seriesSelection, nextState.seriesSelection)) {
      return true;
    }

    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (
      isEqual(this.props.timeseriesData, nextProps.timeseriesData) &&
      isEqual(this.props.releaseSeries, nextProps.releaseSeries) &&
      isEqual(this.props.previousTimeseriesData, nextProps.previousTimeseriesData) &&
      isEqual(this.props.tableData, nextProps.tableData)
    ) {
      return false;
    }

    return true;
  }

  getChartComponent(): ChartComponent {
    const {showDaily, timeseriesData, yAxis, chartComponent} = this.props;
    if (defined(chartComponent)) {
      return chartComponent;
    }

    if (showDaily) {
      return BarChart;
    }
    if (timeseriesData.length > 1) {
      switch (aggregateMultiPlotType(yAxis)) {
        case 'line':
          return LineChart;
        case 'area':
          return AreaChart;
        default:
          throw new Error(`Unknown multi plot type for ${yAxis}`);
      }
    }
    return AreaChart;
  }

  handleLegendSelectChanged = legendChange => {
    const {disableableSeries = []} = this.props;
    const {selected} = legendChange;
    const seriesSelection = Object.keys(selected).reduce((state, key) => {
      // we only want them to be able to disable the Releases&Other series,
      // and not any of the other possible series here
      const disableable =
        ['Releases', 'Other'].includes(key) || disableableSeries.includes(key);
      state[key] = disableable ? selected[key] : true;
      return state;
    }, {});

    // we have to force an update here otherwise ECharts will
    // update its internal state and disable the series
    this.setState({seriesSelection, forceUpdate: true}, () =>
      this.setState({forceUpdate: false})
    );
  };

  renderWorldMap() {
    const {tableData, fromDiscover} = this.props;
    const {data, title} = processTableResults(tableData);
    const tableSeries = [
      {
        seriesName: title,
        data,
      },
    ];
    return <WorldMapChart series={tableSeries} fromDiscover={fromDiscover} />;
  }

  render() {
    const {
      theme,
      loading: _loading,
      reloading: _reloading,
      yAxis,
      releaseSeries,
      zoomRenderProps,
      timeseriesData,
      previousTimeseriesData,
      showLegend,
      legendOptions,
      chartOptions: chartOptionsProp,
      currentSeriesNames,
      previousSeriesNames,
      seriesTransformer,
      previousSeriesTransformer,
      colors,
      height,
      timeframe,
      topEvents,
      ...props
    } = this.props;
    const {seriesSelection} = this.state;

    let Component = this.getChartComponent();
    if (typeof Component === typeof WorldMapChart) {
      return this.renderWorldMap();
    }
    Component = Component as Exclude<
      ChartComponent,
      React.ComponentType<React.ComponentProps<typeof WorldMapChart>>
    >;

    const data = [
      ...(currentSeriesNames.length > 0 ? currentSeriesNames : [t('Current')]),
      ...(previousSeriesNames.length > 0 ? previousSeriesNames : [t('Previous')]),
    ];

    const releasesLegend = t('Releases');

    const hasOther = topEvents && topEvents + 1 === timeseriesData.length;
    if (hasOther) {
      data.push('Other');
    }

    if (Array.isArray(releaseSeries)) {
      data.push(releasesLegend);
    }

    // Temporary fix to improve performance on pages with a high number of releases.
    const releases = releaseSeries && releaseSeries[0];
    const hideReleasesByDefault =
      Array.isArray(releaseSeries) &&
      (releases as any)?.markLine?.data &&
      (releases as any).markLine.data.length >= RELEASE_LINES_THRESHOLD;

    const selected = !Array.isArray(releaseSeries)
      ? seriesSelection
      : Object.keys(seriesSelection).length === 0 && hideReleasesByDefault
      ? {[releasesLegend]: false}
      : seriesSelection;

    const legend = showLegend
      ? {
          right: 16,
          top: 12,
          data,
          selected,
          ...(legendOptions ?? {}),
        }
      : undefined;

    let series = Array.isArray(releaseSeries)
      ? [...timeseriesData, ...releaseSeries]
      : timeseriesData;
    let previousSeries = previousTimeseriesData;

    if (seriesTransformer) {
      series = seriesTransformer(series);
    }

    if (previousSeriesTransformer) {
      previousSeries = previousSeries?.map(
        prev => previousSeriesTransformer(prev) as Series
      );
    }
    const chartColors = timeseriesData.length
      ? colors?.slice(0, series.length) ?? [
          ...theme.charts.getColorPalette(timeseriesData.length - 2 - (hasOther ? 1 : 0)),
        ]
      : undefined;
    if (chartColors && chartColors.length && hasOther) {
      chartColors.push(theme.chartOther);
    }
    const chartOptions = {
      colors: chartColors,
      grid: {
        left: '24px',
        right: '24px',
        top: '32px',
        bottom: '12px',
      },
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis' as const,
        truncate: 80,
        valueFormatter: (value: number) => tooltipFormatter(value, yAxis),
      },
      xAxis: timeframe
        ? {
            min: timeframe.start,
            max: timeframe.end,
          }
        : undefined,
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => axisLabelFormatter(value, yAxis),
        },
      },
      ...(chartOptionsProp ?? {}),
    };

    return (
      <Component
        {...props}
        {...zoomRenderProps}
        {...chartOptions}
        legend={legend}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        series={series}
        previousPeriod={previousSeries ? previousSeries : undefined}
        height={height}
      />
    );
  }
}

const ThemedChart = withTheme(Chart);

export type EventsChartProps = {
  api: Client;
  router: InjectedRouter;
  organization: OrganizationSummary;
  /**
   * Project ids
   */
  projects: number[];
  /**
   * Environment condition.
   */
  environments: string[];
  /**
   * The discover query string to find events with.
   */
  query: string;
  /**
   * The aggregate/metric to plot.
   */
  yAxis: string | string[];
  /**
   * Relative datetime expression. eg. 14d
   */
  period?: string;
  /**
   * Absolute start date.
   */
  start: DateString;
  /**
   * Absolute end date.
   */
  end: DateString;
  /**
   * Should datetimes be formatted in UTC?
   */
  utc?: boolean | null;
  /**
   * Don't show the previous period's data. Will automatically disable
   * when start/end are used.
   */
  disablePrevious?: boolean;
  /**
   * Don't show the release marklines.
   */
  disableReleases?: boolean;
  /**
   * A list of release names to visually emphasize. Can only be used when `disableReleases` is false.
   */
  emphasizeReleases?: string[];
  /**
   * Fetch n top events as dictated by the field and orderby props.
   */
  topEvents?: number;
  /**
   * The fields that act as grouping conditions when generating a topEvents chart.
   */
  field?: string[];
  /**
   * The interval resolution for a chart e.g. 1m, 5m, 1d
   */
  interval?: string;
  /**
   * Order condition when showing topEvents
   */
  orderby?: string;
  /**
   * Override the interval calculation and show daily results.
   */
  showDaily?: boolean;
  confirmedQuery?: boolean;
  /**
   * Override the default color palette.
   */
  colors?: string[];
  /**
   * Markup for optional chart header
   */
  chartHeader?: React.ReactNode;
  releaseQueryExtra?: Query;
  preserveReleaseQueryParams?: boolean;
  /**
   * Chart zoom will change 'pageStart' instead of 'start'
   */
  usePageZoom?: boolean;
  /**
   * Whether or not to zerofill results
   */
  withoutZerofill?: boolean;
  /**
   * Name of the series
   */
  currentSeriesName?: string;
  /**
   * Name of the previous series
   */
  previousSeriesName?: string;
  /**
   * A unique name for what's triggering this request, see organization_events_stats for an allowlist
   */
  referrer?: string;
} & Pick<
  ChartProps,
  | 'seriesTransformer'
  | 'previousSeriesTransformer'
  | 'showLegend'
  | 'minutesThresholdToDisplaySeconds'
  | 'disableableSeries'
  | 'legendOptions'
  | 'chartOptions'
  | 'chartComponent'
  | 'height'
  | 'fromDiscover'
>;

type ChartDataProps = {
  zoomRenderProps: ZoomRenderProps;
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  results?: Series[];
  timeseriesData?: Series[];
  previousTimeseriesData?: Series[] | null;
  releaseSeries?: Series[];
  timeframe?: {start: number; end: number};
  topEvents?: number;
  tableData?: TableDataWithTitle[];
};

class EventsChart extends React.Component<EventsChartProps> {
  isStacked() {
    const {topEvents, yAxis} = this.props;
    return (
      (typeof topEvents === 'number' && topEvents > 0) ||
      (Array.isArray(yAxis) && yAxis.length > 1)
    );
  }

  render() {
    const {
      api,
      organization,
      period,
      utc,
      query,
      router,
      start,
      end,
      projects,
      environments,
      showLegend,
      minutesThresholdToDisplaySeconds,
      yAxis,
      disablePrevious,
      disableReleases,
      emphasizeReleases,
      currentSeriesName: currentName,
      previousSeriesName: previousName,
      seriesTransformer,
      previousSeriesTransformer,
      field,
      interval,
      showDaily,
      topEvents,
      orderby,
      confirmedQuery,
      colors,
      chartHeader,
      legendOptions,
      chartOptions,
      preserveReleaseQueryParams,
      releaseQueryExtra,
      disableableSeries,
      chartComponent,
      usePageZoom,
      height,
      withoutZerofill,
      fromDiscover,
      ...props
    } = this.props;

    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !disablePrevious && !start && !end;

    const yAxisArray = decodeList(yAxis);
    const yAxisSeriesNames = yAxisArray.map(name => {
      let yAxisLabel = name && isEquation(name) ? getEquation(name) : name;
      if (yAxisLabel && yAxisLabel.length > 60) {
        yAxisLabel = yAxisLabel.substr(0, 60) + '...';
      }
      return yAxisLabel;
    });

    const previousSeriesNames = previousName
      ? [previousName]
      : yAxisSeriesNames.map(name => t('previous %s', name));
    const currentSeriesNames = currentName ? [currentName] : yAxisSeriesNames;

    const intervalVal = showDaily ? '1d' : interval || getInterval(this.props, 'high');

    let chartImplementation = ({
      zoomRenderProps,
      releaseSeries,
      errored,
      loading,
      reloading,
      results,
      timeseriesData,
      previousTimeseriesData,
      timeframe,
      tableData,
    }: ChartDataProps) => {
      if (errored) {
        return (
          <ErrorPanel>
            <IconWarning color="gray300" size="lg" />
          </ErrorPanel>
        );
      }
      const seriesData = results ? results : timeseriesData;

      return (
        <TransitionChart
          loading={loading}
          reloading={reloading}
          height={height ? `${height}px` : undefined}
        >
          <TransparentLoadingMask visible={reloading} />

          {React.isValidElement(chartHeader) && chartHeader}

          <ThemedChart
            zoomRenderProps={zoomRenderProps}
            loading={loading}
            reloading={reloading}
            showLegend={showLegend}
            minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
            releaseSeries={releaseSeries || []}
            timeseriesData={seriesData ?? []}
            previousTimeseriesData={previousTimeseriesData}
            currentSeriesNames={currentSeriesNames}
            previousSeriesNames={previousSeriesNames}
            seriesTransformer={seriesTransformer}
            previousSeriesTransformer={previousSeriesTransformer}
            stacked={this.isStacked()}
            yAxis={yAxisArray[0]}
            showDaily={showDaily}
            colors={colors}
            legendOptions={legendOptions}
            chartOptions={chartOptions}
            disableableSeries={disableableSeries}
            chartComponent={chartComponent}
            height={height}
            timeframe={timeframe}
            topEvents={topEvents}
            tableData={tableData ?? []}
            fromDiscover={fromDiscover}
          />
        </TransitionChart>
      );
    };

    if (!disableReleases) {
      const previousChart = chartImplementation;
      chartImplementation = chartProps => (
        <ReleaseSeries
          utc={utc}
          period={period}
          start={start}
          end={end}
          projects={projects}
          environments={environments}
          emphasizeReleases={emphasizeReleases}
          preserveQueryParams={preserveReleaseQueryParams}
          queryExtra={releaseQueryExtra}
        >
          {({releaseSeries}) => previousChart({...chartProps, releaseSeries})}
        </ReleaseSeries>
      );
    }

    return (
      <ChartZoom
        router={router}
        period={period}
        start={start}
        end={end}
        utc={utc}
        usePageDate={usePageZoom}
        {...props}
      >
        {zoomRenderProps => {
          if (chartComponent === WorldMapChart) {
            return (
              <EventsGeoRequest
                api={api}
                organization={organization}
                yAxis={yAxis}
                query={query}
                orderby={orderby}
                projects={projects}
                period={period}
                start={start}
                end={end}
                environments={environments}
                referrer={props.referrer}
              >
                {({errored, loading, reloading, tableData}) =>
                  chartImplementation({
                    errored,
                    loading,
                    reloading,
                    zoomRenderProps,
                    tableData,
                  })
                }
              </EventsGeoRequest>
            );
          }
          return (
            <EventsRequest
              {...props}
              api={api}
              organization={organization}
              period={period}
              project={projects}
              environment={environments}
              start={start}
              end={end}
              interval={intervalVal}
              query={query}
              includePrevious={includePrevious}
              currentSeriesNames={currentSeriesNames}
              previousSeriesNames={previousSeriesNames}
              yAxis={yAxis}
              field={field}
              orderby={orderby}
              topEvents={topEvents}
              confirmedQuery={confirmedQuery}
              partial
              // Cannot do interpolation when stacking series
              withoutZerofill={withoutZerofill && !this.isStacked()}
            >
              {eventData => {
                return chartImplementation({
                  ...eventData,
                  zoomRenderProps,
                });
              }}
            </EventsRequest>
          );
        }}
      </ChartZoom>
    );
  }
}

export default EventsChart;
