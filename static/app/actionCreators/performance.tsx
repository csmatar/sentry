import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import parseLinkHeader from 'app/utils/parseLinkHeader';

type TransactionNames = Set<string>;
type KeyTransactionPerProject = Map<string, TransactionNames>;
export type TeamKeyTransactions = Map<string, KeyTransactionPerProject>;

export async function fetchTeamKeyTransactions(
  api: Client,
  orgSlug: string,
  teams: string | string[]
): Promise<TeamKeyTransactions> {
  const url = `/organizations/${orgSlug}/key-transactions-list/`;

  let cursor: string | undefined = undefined;
  let hasMore = true;

  const teamKeyTransactions = new Map();

  while (hasMore) {
    try {
      const [data, , xhr] = await api.requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {cursor, team: teams},
      });

      data.forEach(({team, keyed}) => {
        const keyTransactionsForTeam = keyed.reduce((kts, {project_id, transaction}) => {
          if (!kts.has(project_id)) {
            kts.set(project_id, new Set());
          }
          kts.get(project_id).add(transaction);
          return kts;
        }, new Map());
        teamKeyTransactions.set(team, keyTransactionsForTeam);
      });

      const pageLinks = xhr && xhr.getResponseHeader('Link');
      if (pageLinks) {
        const paginationObject = parseLinkHeader(pageLinks);
        hasMore = paginationObject?.next?.results ?? false;
        cursor = paginationObject.next?.cursor;
      } else {
        hasMore = false;
      }
    } catch (err) {
      addErrorMessage(
        err.responseJSON?.detail ?? t('Error fetching team key transactions')
      );
      throw err;
    }
  }

  return teamKeyTransactions;
}

export function toggleKeyTransaction(
  api: Client,
  isKeyTransaction: boolean,
  orgId: string,
  projects: Readonly<number[]>,
  transactionName: string,
  teamIds?: string[] // TODO(txiao): make this required
): Promise<undefined> {
  addLoadingMessage(t('Saving changes\u2026'));

  const promise: Promise<undefined> = api.requestPromise(
    `/organizations/${orgId}/key-transactions/`,
    {
      method: isKeyTransaction ? 'DELETE' : 'POST',
      query: {
        project: projects.map(id => String(id)),
      },
      data: {
        transaction: transactionName,
        team: teamIds,
      },
    }
  );

  promise.then(clearIndicators);

  promise.catch(response => {
    const non_field_errors = response?.responseJSON?.non_field_errors;

    if (
      Array.isArray(non_field_errors) &&
      non_field_errors.length &&
      non_field_errors[0]
    ) {
      addErrorMessage(response.responseJSON.non_field_errors[0]);
    } else {
      addErrorMessage(t('Unable to update key transaction'));
    }
  });

  return promise;
}
