import {configure} from '@testing-library/react';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import Enzyme from 'enzyme'; // eslint-disable-line no-restricted-imports
import MockDate from 'mockdate';
import PropTypes from 'prop-types';

import ConfigStore from 'app/stores/configStore';

import {loadFixtures} from './sentry-test/loadFixtures';

export * from './sentry-test/select';

/**
 * XXX(epurkhiser): Gross hack to fix a bug in jsdom which makes testing of
 * framer-motion SVG components fail
 *
 * See https://github.com/jsdom/jsdom/issues/1330
 */
if (!SVGElement.prototype.getTotalLength) {
  SVGElement.prototype.getTotalLength = () => 1;
}

/**
 * React Testing Library configuration to override the default test id attribute
 *
 * See: https://testing-library.com/docs/queries/bytestid/#overriding-data-testid
 */
configure({testIdAttribute: 'data-test-id'});

/**
 * Enzyme configuration
 *
 * TODO(epurkhiser): We're using @wojtekmaj's react-17 enzyme adapter, until
 * the offical adapter has been released.
 *
 * https://github.com/enzymejs/enzyme/issues/2429
 */
Enzyme.configure({adapter: new Adapter()});

/**
 * Mock (current) date to always be National Pasta Day
 * 2017-10-17T02:41:20.000Z
 */
const constantDate = new Date(1508208080000);
MockDate.set(constantDate);

/**
 * Load all files in `tests/js/fixtures/*` as a module.
 * These will then be added to the `TestStubs` global below
 */
const fixtures = loadFixtures('js-stubs', {flatten: true});

/**
 * Global testing configuration
 */
ConfigStore.loadInitialData({
  messages: [],
  user: fixtures.User(),
});

/**
 * Mocks
 */
jest.mock('lodash/debounce', () => jest.fn(fn => fn));
jest.mock('app/utils/recreateRoute');
jest.mock('app/api');
jest.mock('app/utils/domId');
jest.mock('app/utils/withOrganization');
jest.mock('scroll-to-element', () => jest.fn());
jest.mock('react-router', () => {
  const ReactRouter = jest.requireActual('react-router');
  return {
    IndexRedirect: ReactRouter.IndexRedirect,
    IndexRoute: ReactRouter.IndexRoute,
    Link: ReactRouter.Link,
    Redirect: ReactRouter.Redirect,
    Route: ReactRouter.Route,
    withRouter: ReactRouter.withRouter,
    browserHistory: {
      goBack: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      listen: jest.fn(() => {}),
    },
  };
});
jest.mock('react-lazyload', () => {
  const LazyLoadMock = ({children}) => children;
  return LazyLoadMock;
});

jest.mock('react-virtualized', () => {
  const ActualReactVirtualized = jest.requireActual('react-virtualized');
  return {
    ...ActualReactVirtualized,
    AutoSizer: ({children}) => children({width: 100, height: 100}),
  };
});

jest.mock('echarts-for-react/lib/core', () => {
  // We need to do this because `jest.mock` gets hoisted by babel and `React` is not
  // guaranteed to be in scope
  const ReactActual = require('react');

  // We need a class component here because `BaseChart` passes `ref` which will
  // error if we return a stateless/functional component
  return class extends ReactActual.Component {
    render() {
      return null;
    }
  };
});

jest.mock('@sentry/react', () => {
  const SentryReact = jest.requireActual('@sentry/react');
  return {
    init: jest.fn(),
    configureScope: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    setExtra: jest.fn(),
    setExtras: jest.fn(),
    captureBreadcrumb: jest.fn(),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    showReportDialog: jest.fn(),
    startSpan: jest.fn(),
    finishSpan: jest.fn(),
    lastEventId: jest.fn(),
    getCurrentHub: jest.spyOn(SentryReact, 'getCurrentHub'),
    withScope: jest.spyOn(SentryReact, 'withScope'),
    Severity: SentryReact.Severity,
    withProfiler: SentryReact.withProfiler,
    startTransaction: () => ({
      finish: jest.fn(),
      setTag: jest.fn(),
      setData: jest.fn(),
      setStatus: jest.fn(),
    }),
  };
});

jest.mock('popper.js', () => {
  const PopperJS = jest.requireActual('popper.js');

  return class {
    static placements = PopperJS.placements;

    constructor() {
      return {
        destroy: () => {},
        scheduleUpdate: () => {},
      };
    }
  };
});

/**
 * Test Globals
 */

// This is so we can use async/await in tests instead of wrapping with `setTimeout`.
window.tick = () => new Promise(resolve => setTimeout(resolve));

window.scrollTo = jest.fn();

// This is very commonly used, so expose it globally.
window.MockApiClient = jest.requireMock('app/api').Client;

window.TestStubs = {
  // react-router's 'router' context
  router: (params = {}) => ({
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    listen: jest.fn(),
    setRouteLeaveHook: jest.fn(),
    isActive: jest.fn(),
    createHref: jest.fn(),
    location: {query: {}},
    ...params,
  }),

  location: (params = {}) => ({
    query: {},
    pathname: '/mock-pathname/',
    ...params,
  }),

  routerProps: (params = {}) => ({
    location: TestStubs.location(),
    params: {},
    routes: [],
    stepBack: () => {},
    ...params,
  }),

  routerContext: ([context, childContextTypes] = []) => ({
    context: {
      location: TestStubs.location(),
      router: TestStubs.router(),
      organization: fixtures.Organization(),
      project: fixtures.Project(),
      ...context,
    },
    childContextTypes: {
      router: PropTypes.object,
      location: PropTypes.object,
      organization: PropTypes.object,
      project: PropTypes.object,
      ...childContextTypes,
    },
  }),

  AllAuthenticators: () => Object.values(fixtures.Authenticators()).map(x => x()),
  ...fixtures,
};

// We now need to re-define `window.location`, otherwise we can't spyOn certain methods
// as `window.location` is read-only
Object.defineProperty(window, 'location', {
  value: {...window.location, assign: jest.fn(), reload: jest.fn()},
  configurable: true,
  writable: true,
});
