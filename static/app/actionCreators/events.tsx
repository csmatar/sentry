import {LocationDescriptor} from 'history';
import pick from 'lodash/pick';

import {Client} from 'app/api';
import {canIncludePreviousPeriod} from 'app/components/charts/utils';
import {
  DateString,
  EventsStats,
  MultiSeriesEventsStats,
  OrganizationSummary,
} from 'app/types';
import {LocationQuery} from 'app/utils/discover/eventView';
import {getPeriod} from 'app/utils/getPeriod';
import {PERFORMANCE_URL_PARAM} from 'app/utils/performance/constants';

type Options = {
  organization: OrganizationSummary;
  project?: Readonly<number[]>;
  environment?: Readonly<string[]>;
  team?: Readonly<string | string[]>;
  period?: string;
  start?: DateString;
  end?: DateString;
  interval?: string;
  comparisonDelta?: number;
  includePrevious?: boolean;
  limit?: number;
  query?: string;
  yAxis?: string | string[];
  field?: string[];
  topEvents?: number;
  orderby?: string;
  partial: boolean;
  withoutZerofill?: boolean;
  referrer?: string;
};

/**
 * Make requests to `events-stats` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.project List of project ids
 * @param {String[]} options.environment List of environments to query for
 * @param {String[]} options.team List of teams to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Number} options.comparisonDelta Comparison delta for change alert event stats to include comparison stats
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 */
export const doEventsRequest = (
  api: Client,
  {
    organization,
    project,
    environment,
    team,
    period,
    start,
    end,
    interval,
    comparisonDelta,
    includePrevious,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial,
    withoutZerofill,
    referrer,
  }: Options
): Promise<EventsStats | MultiSeriesEventsStats> => {
  const shouldDoublePeriod = canIncludePreviousPeriod(includePrevious, period);
  const urlQuery = Object.fromEntries(
    Object.entries({
      interval,
      comparisonDelta,
      project,
      environment,
      team,
      query,
      yAxis,
      field,
      topEvents,
      orderby,
      partial: partial ? '1' : undefined,
      withoutZerofill: withoutZerofill ? '1' : undefined,
      referrer: referrer ? referrer : 'api.organization-event-stats',
    }).filter(([, value]) => typeof value !== 'undefined')
  );

  // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.
  const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

  return api.requestPromise(`/organizations/${organization.slug}/events-stats/`, {
    query: {
      ...urlQuery,
      ...periodObj,
    },
  });
};

export type EventQuery = {
  field: string[];
  equation?: string[];
  team?: string | string[];
  project?: string | string[];
  sort?: string | string[];
  query: string;
  per_page?: number;
  referrer?: string;
  environment?: string[];
  noPagination?: boolean;
};

export type TagSegment = {
  count: number;
  name: string;
  value: string;
  url: LocationDescriptor;
  isOther?: boolean;
  key?: string;
};

export type Tag = {
  key: string;
  topValues: Array<TagSegment>;
};

/**
 * Fetches tag facets for a query
 */
export async function fetchTagFacets(
  api: Client,
  orgSlug: string,
  query: EventQuery
): Promise<Tag[]> {
  const urlParams = pick(query, Object.values(PERFORMANCE_URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  return api.requestPromise(`/organizations/${orgSlug}/events-facets/`, {
    query: queryOption,
  });
}

/**
 * Fetches total count of events for a given query
 */
export async function fetchTotalCount(
  api: Client,
  orgSlug: String,
  query: EventQuery & LocationQuery
): Promise<number> {
  const urlParams = pick(query, Object.values(PERFORMANCE_URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  type Response = {
    count: number;
  };

  return api
    .requestPromise(`/organizations/${orgSlug}/events-meta/`, {
      query: queryOption,
    })
    .then((res: Response) => res.count);
}
