import {Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {getAggregateArg, getMeasurementSlug} from 'app/utils/discover/fields';
import getDynamicText from 'app/utils/getDynamicText';
import useApi from 'app/utils/useApi';
import {TransactionsListOption} from 'app/views/releases/detail/overview';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
    queryExtra: object;
    withoutZerofill: boolean;
  };

const YAXIS_VALUES = [
  'p75(measurements.fp)',
  'p75(measurements.fcp)',
  'p75(measurements.lcp)',
  'p75(measurements.fid)',
];

function VitalsChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  router,
  queryExtra,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
}: Props) {
  const api = useApi();
  const theme = useTheme();

  const handleLegendSelectChanged = legendChange => {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const {utc} = getParams(location.query);

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
    formatter: seriesName => {
      const arg = getAggregateArg(seriesName);
      if (arg !== null) {
        const slug = getMeasurementSlug(arg);
        if (slug !== null) {
          seriesName = slug.toUpperCase();
        }
      }
      return seriesName;
    },
  };

  const datetimeSelection = {
    start,
    end,
    period: statsPeriod,
  };

  return (
    <Fragment>
      <HeaderTitleLegend>
        {t('Web Vitals Breakdown')}
        <QuestionTooltip
          size="sm"
          position="top"
          title={t(
            `Web Vitals Breakdown reflects the 75th percentile of web vitals over time.`
          )}
        />
      </HeaderTitleLegend>
      <ChartZoom
        router={router}
        period={statsPeriod}
        start={start}
        end={end}
        utc={utc === 'true'}
      >
        {zoomRenderProps => (
          <EventsRequest
            api={api}
            organization={organization}
            period={statsPeriod}
            project={project}
            environment={environment}
            start={start}
            end={end}
            interval={getInterval(datetimeSelection, 'high')}
            showLoading={false}
            query={query}
            includePrevious={false}
            yAxis={YAXIS_VALUES}
            partial
            withoutZerofill={withoutZerofill}
            referrer="api.performance.transaction-summary.vitals-chart"
          >
            {({results, errored, loading, reloading, timeframe}) => {
              if (errored) {
                return (
                  <ErrorPanel>
                    <IconWarning color="gray500" size="lg" />
                  </ErrorPanel>
                );
              }

              const chartOptions = {
                grid: {
                  left: '10px',
                  right: '10px',
                  top: '40px',
                  bottom: '0px',
                },
                seriesOptions: {
                  showSymbol: false,
                },
                tooltip: {
                  trigger: 'axis' as const,
                  valueFormatter: tooltipFormatter,
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
                    // p75(measurements.fcp) coerces the axis to be time based
                    formatter: (value: number) =>
                      axisLabelFormatter(value, 'p75(measurements.fcp)'),
                  },
                },
              };

              const colors =
                (results && theme.charts.getColorPalette(results.length - 2)) || [];

              // Create a list of series based on the order of the fields,
              const series = results
                ? results.map((values, i: number) => ({
                    ...values,
                    color: colors[i],
                  }))
                : [];

              return (
                <ReleaseSeries
                  start={start}
                  end={end}
                  queryExtra={{
                    ...queryExtra,
                    showTransactions: TransactionsListOption.SLOW_LCP,
                  }}
                  period={statsPeriod}
                  utc={utc === 'true'}
                  projects={project}
                  environments={environment}
                >
                  {({releaseSeries}) => (
                    <TransitionChart loading={loading} reloading={reloading}>
                      <TransparentLoadingMask visible={reloading} />
                      {getDynamicText({
                        value: (
                          <LineChart
                            {...zoomRenderProps}
                            {...chartOptions}
                            legend={legend}
                            onLegendSelectChanged={handleLegendSelectChanged}
                            series={[...series, ...releaseSeries]}
                          />
                        ),
                        fixed: <Placeholder height="200px" testId="skeleton-ui" />,
                      })}
                    </TransitionChart>
                  )}
                </ReleaseSeries>
              );
            }}
          </EventsRequest>
        )}
      </ChartZoom>
    </Fragment>
  );
}

export default withRouter(VitalsChart);
