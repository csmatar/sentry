import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'app/stores/configStore';
import App from 'app/views/app';

describe('App', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization({slug: 'billy-org', name: 'billy org'})],
    });

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/assistant/?v2',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard(),
    });
  });

  it('renders', async function () {
    mountWithTheme(
      <App params={{orgId: 'org-slug'}}>
        <div>placeholder content</div>
      </App>
    );

    expect(screen.getByText('placeholder content')).toBeInTheDocument();
  });

  it('renders NewsletterConsent', async function () {
    const user = ConfigStore.get('user');
    user.flags.newsletter_consent_prompt = true;

    mountWithTheme(
      <App params={{orgId: 'org-slug'}}>
        <div>placeholder content</div>
      </App>
    );

    const updatesViaEmail = await screen.findByText(
      'Yes, I would like to receive updates via email'
    );
    expect(updatesViaEmail).toBeInTheDocument();

    user.flags.newsletter_consent_prompt = false;
  });

  it('renders InstallWizard', async function () {
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('needsUpgrade', true);
    ConfigStore.set('version', {current: '1.33.7'});

    mountWithTheme(
      <App params={{orgId: 'org-slug'}}>
        <div>placeholder content</div>
      </App>
    );

    const completeSetup = await screen.findByText(
      'Complete setup by filling out the required configuration.'
    );
    expect(completeSetup).toBeInTheDocument();
  });
});
