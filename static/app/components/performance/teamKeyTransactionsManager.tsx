import {Component, createContext, ReactNode} from 'react';

import {
  fetchTeamKeyTransactions,
  TeamKeyTransactions,
  toggleKeyTransaction,
} from 'app/actionCreators/performance';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, Team} from 'app/types';
import withApi from 'app/utils/withApi';

export type SelectionBase = {
  action: 'key' | 'unkey';
  project: number;
  transactionName: string;
};
export type MyTeamSelection = SelectionBase & {type: 'my teams'};
export type TeamIdSelection = SelectionBase & {type: 'id'; teamId: string};
export type TeamSelection = MyTeamSelection | TeamIdSelection;

export function isMyTeamSelection(
  selection: TeamSelection
): selection is MyTeamSelection {
  return selection.type === 'my teams';
}

export type TeamKeyTransactionManagerChildrenProps = {
  teams: Team[];
  isLoading: boolean;
  error: string | null;
  counts: Map<string, number> | null;
  getKeyedTeams: (project: string, transactionName: string) => Set<string> | null;
  handleToggleKeyTransaction: (selection: TeamSelection) => void;
};

const TeamKeyTransactionsManagerContext = createContext<TeamKeyTransactionManagerChildrenProps>(
  {
    teams: [],
    isLoading: false,
    error: null,
    counts: null,
    getKeyedTeams: () => null,
    handleToggleKeyTransaction: () => {},
  }
);

type Props = {
  api: Client;
  children: ReactNode;
  organization: Organization;
  teams: Team[];
  selectedTeams: string[];
};

type State = Omit<
  TeamKeyTransactionManagerChildrenProps,
  'teams' | 'counts' | 'getKeyedTeams' | 'handleToggleKeyTransaction'
> & {
  keyFetchID: symbol | null;
  teamKeyTransactions: TeamKeyTransactions;
};

class UnwrappedProvider extends Component<Props> {
  state: State = {
    keyFetchID: null,
    isLoading: true,
    error: null,
    teamKeyTransactions: new Map(),
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const orgSlugChanged = prevProps.organization.slug !== this.props.organization.slug;

    const selectedTeamsChanged =
      prevProps.selectedTeams.length !== this.props.selectedTeams.length ||
      prevProps.selectedTeams.every(
        (teamId, i) => this.props.selectedTeams[i] !== teamId
      );

    if (orgSlugChanged || selectedTeamsChanged) {
      this.fetchData();
    }
  }

  async fetchData() {
    const {api, organization, selectedTeams} = this.props;
    const keyFetchID = Symbol('keyFetchID');
    this.setState({isLoading: true, keyFetchID});

    let teamKeyTransactions: TeamKeyTransactions = new Map();
    let error: string | null = null;

    try {
      teamKeyTransactions = await fetchTeamKeyTransactions(
        api,
        organization.slug,
        selectedTeams
      );
    } catch (err) {
      error = err.responseJSON?.detail ?? t('Error fetching team key transactions');
    }

    this.setState({
      isLoading: false,
      keyFetchID: undefined,
      error,
      teamKeyTransactions,
    });
  }

  getCounts() {
    const {teamKeyTransactions} = this.state;

    const counts: Map<string, number> = new Map();

    teamKeyTransactions.forEach((keyTransactions, team) => {
      let count = 0;
      for (const transactionNames of keyTransactions.values()) {
        count += transactionNames.size;
      }
      counts.set(team, count);
    });

    return counts;
  }

  getKeyedTeams = (project: string, transactionName: string) => {
    const {teamKeyTransactions} = this.state;

    const keyedTeams: Set<string> = new Set();

    teamKeyTransactions.forEach((keyTransactions, team) => {
      if (keyTransactions.get(project)?.has(transactionName)) {
        keyedTeams.add(team);
      }
    });

    return keyedTeams;
  };

  handleToggleKeyTransaction = async (selection: TeamSelection) => {
    const {api, organization} = this.props;
    const {teamKeyTransactions} = this.state;
    const {action, project, transactionName} = selection;
    const isKeyTransaction = action === 'unkey';

    const {teamIds} = isMyTeamSelection(selection)
      ? this.toggleKeyTransactionForMyTeams()
      : this.toggleKeyTransactionForTeam(selection);

    // TODO: clone `teamKeyTransactions`
    const newTeamKeyTransactions = teamKeyTransactions;

    for (const teamId of teamIds) {
      if (!newTeamKeyTransactions.has(teamId)) {
        newTeamKeyTransactions.set(teamId, new Map());
      }
      const team = newTeamKeyTransactions.get(teamId)!;
      if (!team.has(String(project))) {
        team.set(String(project), new Set());
      }
      const transactionNames = team.get(String(project))!;
      if (isKeyTransaction) {
        transactionNames?.delete(transactionName);
      } else {
        transactionNames?.add(transactionName);
      }
    }

    try {
      await toggleKeyTransaction(
        api,
        isKeyTransaction,
        organization.slug,
        [project],
        transactionName,
        teamIds
      );
      this.setState({teamKeyTransactions});
    } catch (err) {
      this.setState({
        error: err.responseJSON?.detail ?? null,
      });
    }
  };

  toggleKeyTransactionForMyTeams() {
    const {teams} = this.props;

    return {
      teamIds: teams.filter(({isMember}) => isMember).map(({id}) => id),
    };
  }

  toggleKeyTransactionForTeam(selection: TeamIdSelection) {
    const {teamId} = selection;

    return {
      teamIds: [teamId],
    };
  }

  render() {
    const {teams} = this.props;
    const {isLoading, error} = this.state;

    const childrenProps: TeamKeyTransactionManagerChildrenProps = {
      teams,
      isLoading,
      error,
      counts: this.getCounts(),
      getKeyedTeams: this.getKeyedTeams,
      handleToggleKeyTransaction: this.handleToggleKeyTransaction,
    };

    return (
      <TeamKeyTransactionsManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </TeamKeyTransactionsManagerContext.Provider>
    );
  }
}

export const Provider = withApi(UnwrappedProvider);

export const Consumer = TeamKeyTransactionsManagerContext.Consumer;
