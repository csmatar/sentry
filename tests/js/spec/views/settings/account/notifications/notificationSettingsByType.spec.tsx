import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {NotificationSettingsObject} from 'app/views/settings/account/notifications/constants';
import NotificationSettingsByType from 'app/views/settings/account/notifications/notificationSettingsByType';
import {
  Identity,
  OrganizationIntegration,
} from 'app/views/settings/account/notifications/types';

const addMockResponses = (
  notificationSettings: NotificationSettingsObject,
  identities: Identity[] = [],
  organizationIntegrations: OrganizationIntegration[] = []
) => {
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/users/me/notification-settings/',
    method: 'GET',
    body: notificationSettings,
  });

  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/users/me/identities/',
    method: 'GET',
    body: identities,
  });

  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/users/me/organization-integrations/',
    method: 'GET',
    body: organizationIntegrations,
  });
};

const createWrapper = (
  notificationSettings: NotificationSettingsObject,
  identities: Identity[] = [],
  organizationIntegrations: OrganizationIntegration[] = []
) => {
  const {routerContext} = initializeOrg();
  // @ts-expect-error
  const org = TestStubs.Organization();
  addMockResponses(notificationSettings, identities, organizationIntegrations);
  return mountWithTheme(
    <NotificationSettingsByType notificationType="alerts" organizations={[org]} />,
    routerContext
  );
};

describe('NotificationSettingsByType', function () {
  it('should render when everything is disabled', function () {
    const wrapper = createWrapper({
      alerts: {user: {me: {email: 'never', slack: 'never'}}},
    });

    // There is only one field and it is the default and it is set to "off".
    const fields = wrapper.find('Field');
    expect(fields).toHaveLength(1);
    expect(fields.at(0).find('FieldLabel').text()).toEqual('Issue Alerts');
    expect(fields.at(0).find('Select').text()).toEqual('Off');
  });

  it('should render when notification settings are enabled', function () {
    const wrapper = createWrapper({
      alerts: {user: {me: {email: 'always', slack: 'always'}}},
    });
    const fields = wrapper.find('Field');
    expect(fields).toHaveLength(2);
    expect(fields.at(0).find('FieldLabel').text()).toEqual('Issue Alerts');
    expect(fields.at(0).find('Select').text()).toEqual('On');
    expect(fields.at(1).find('FieldLabel').text()).toEqual('Delivery Method');
    expect(fields.at(1).find('Select').text()).toEqual('Send to Email and Slack');
  });

  it('should render warning modal when identity not linked', function () {
    // @ts-expect-error
    const org = TestStubs.Organization();
    const wrapper = createWrapper(
      {
        alerts: {user: {me: {email: 'always', slack: 'always'}}},
      },
      [],
      // @ts-expect-error
      [TestStubs.OrganizationIntegrations()]
    );
    const alert = wrapper.find('StyledAlert');
    expect(alert).toHaveLength(2);
    const organizationSlugs = alert.at(0).find('li');
    expect(organizationSlugs).toHaveLength(1);
    expect(organizationSlugs.at(0).text()).toEqual(org.slug);
  });

  it('should not render warning modal when identity is linked', function () {
    // @ts-expect-error
    const org = TestStubs.Organization();
    const wrapper = createWrapper(
      {
        alerts: {user: {me: {email: 'always', slack: 'always'}}},
      },
      // @ts-expect-error
      [TestStubs.UserIdentity()],
      // @ts-expect-error
      [TestStubs.OrganizationIntegrations({organizationId: org.id})]
    );
    const alert = wrapper.find('StyledAlert');
    expect(alert).toHaveLength(1);
  });
});
