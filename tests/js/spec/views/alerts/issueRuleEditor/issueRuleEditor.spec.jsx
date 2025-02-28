import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {selectByValue} from 'sentry-test/select-new';

import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';
import {metric} from 'app/utils/analytics';
import IssueRuleEditor from 'app/views/alerts/issueRuleEditor';
import ProjectAlerts from 'app/views/settings/projectAlerts';

jest.unmock('app/utils/recreateRoute');
jest.mock('app/actionCreators/onboardingTasks');
jest.mock('app/utils/analytics', () => ({
  metric: {
    startTransaction: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    endTransaction: jest.fn(),
    mark: jest.fn(),
    measure: jest.fn(),
  },
}));

describe('ProjectAlerts -> IssueRuleEditor', function () {
  const projectAlertRuleDetailsRoutes = [
    {
      path: '/',
    },
    {
      path: '/settings/',
      name: 'Settings',
      indexRoute: {},
    },
    {
      name: 'Organization',
      path: ':orgId/',
    },
    {
      name: 'Project',
      path: 'projects/:projectId/',
    },
    {},
    {
      indexRoute: {name: 'General'},
    },
    {
      name: 'Alert Rules',
      path: 'alerts/',
      indexRoute: {},
    },
    {
      path: 'rules/',
      name: 'Rules',
      component: null,
      indexRoute: {},
      childRoutes: [
        {path: 'new/', name: 'New'},
        {path: ':ruleId/', name: 'Edit'},
      ],
    },
    {path: ':ruleId/', name: 'Edit Alert Rule'},
  ];

  beforeEach(async function () {
    browserHistory.replace = jest.fn();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/configuration/',
      body: TestStubs.ProjectAlertRuleConfiguration(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      body: TestStubs.ProjectAlertRule(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: TestStubs.Environments(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/?expand=hasAlertIntegration`,
      body: {},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  const createWrapper = (props = {}) => {
    const {organization, project, routerContext} = initializeOrg(props);
    const params = {orgId: organization.slug, projectId: project.slug, ruleId: '1'};
    const onChangeTitleMock = jest.fn();
    const wrapper = mountWithTheme(
      <ProjectAlerts organization={organization} params={params}>
        <IssueRuleEditor
          params={params}
          location={{pathname: ''}}
          routes={projectAlertRuleDetailsRoutes}
          onChangeTitle={onChangeTitleMock}
          project={project}
          userTeamIds={[]}
        />
      </ProjectAlerts>,
      routerContext
    );

    return {
      wrapper,
      organization,
      project,
    };
  };
  describe('Edit Rule', function () {
    let mock;
    const endpoint = '/projects/org-slug/project-slug/rules/1/';
    beforeEach(async function () {
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'PUT',
        body: TestStubs.ProjectAlertRule(),
      });
      metric.startTransaction.mockClear();
    });

    it('gets correct rule name', async function () {
      const rule = TestStubs.ProjectAlertRule();
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'GET',
        body: rule,
      });
      const {wrapper} = createWrapper();
      expect(mock).toHaveBeenCalled();
      expect(wrapper.find('IssueRuleEditor').prop('onChangeTitle')).toHaveBeenCalledWith(
        rule.name
      );
    });

    it('deletes rule', async function () {
      const deleteMock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'DELETE',
        body: {},
      });
      const {wrapper} = createWrapper();
      wrapper.find('button[aria-label="Delete Rule"]').simulate('click');

      const modal = await mountGlobalModal();
      modal.find('button[aria-label="Delete Rule"]').simulate('click');

      await tick();
      expect(deleteMock).toHaveBeenCalled();
      expect(browserHistory.replace).toHaveBeenCalledWith(
        '/settings/org-slug/projects/project-slug/alerts/'
      );
    });

    it('sends correct environment value', async function () {
      const {wrapper} = createWrapper();
      selectByValue(wrapper, 'production', {name: 'environment'});
      wrapper.find('form').simulate('submit');

      expect(mock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: expect.objectContaining({environment: 'production'}),
        })
      );
      expect(metric.startTransaction).toHaveBeenCalledTimes(1);
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('strips environment value if "All environments" is selected', async function () {
      const {wrapper} = createWrapper();
      selectByValue(wrapper, '__all_environments__', {name: 'environment'});
      wrapper.find('form').simulate('submit');

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).not.toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: expect.objectContaining({environment: '__all_environments__'}),
        })
      );
      expect(metric.startTransaction).toHaveBeenCalledTimes(1);
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('updates the alert onboarding task', async function () {
      const {wrapper} = createWrapper();
      wrapper.find('form').simulate('submit');

      expect(updateOnboardingTask).toHaveBeenCalled();
      expect(metric.startTransaction).toHaveBeenCalledTimes(1);
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });
  });

  describe('Edit Rule: Slack Channel Look Up', function () {
    const uuid = 'xxxx-xxxx-xxxx';

    beforeEach(async function () {
      jest.useFakeTimers();
    });

    afterEach(function () {
      jest.clearAllTimers();
      MockApiClient.clearMockResponses();
    });

    it('pending status keeps loading true', async function () {
      const endpoint = `/projects/org-slug/project-slug/rule-task/${uuid}/`;
      MockApiClient.addMockResponse({
        url: endpoint,
        body: {status: 'pending'},
      });
      const {wrapper} = createWrapper();
      const ruleEditor = wrapper.find('IssueRuleEditor').last();

      ruleEditor.setState({uuid, loading: true});
      await Promise.resolve();
      ruleEditor.update();

      ruleEditor.instance().fetchStatus();
      jest.runOnlyPendingTimers();

      await Promise.resolve();
      ruleEditor.update();
      expect(ruleEditor.state('loading')).toBe(true);
    });

    it('failed status renders error message', async function () {
      const endpoint = `/projects/org-slug/project-slug/rule-task/${uuid}/`;
      MockApiClient.addMockResponse({
        url: endpoint,
        body: {status: 'failed'},
      });
      const {wrapper} = createWrapper();
      const ruleEditor = wrapper.find('IssueRuleEditor').last();

      ruleEditor.setState({uuid, loading: true});
      await Promise.resolve();
      ruleEditor.update();

      ruleEditor.instance().fetchStatus();
      jest.runAllTimers();

      await Promise.resolve();
      ruleEditor.update();

      expect(ruleEditor.state('loading')).toBe(false);
      expect(ruleEditor.state('detailedError')).toEqual({actions: ['An error occurred']});
    });

    it('success status updates the rule', async function () {
      const endpoint = `/projects/org-slug/project-slug/rule-task/${uuid}/`;
      MockApiClient.addMockResponse({
        url: endpoint,
        body: {status: 'success', rule: TestStubs.ProjectAlertRule({name: 'Slack Rule'})},
      });
      const {wrapper} = createWrapper();
      const ruleEditor = wrapper.find('IssueRuleEditor').last();

      ruleEditor.setState({uuid, loading: true});
      await Promise.resolve();
      ruleEditor.update();

      ruleEditor.instance().fetchStatus();
      jest.runOnlyPendingTimers();

      await Promise.resolve();
      ruleEditor.update();
      expect(ruleEditor.state('loading')).toBe(false);
      expect(ruleEditor.state('rule').name).toBe('Slack Rule');
    });
  });
});
