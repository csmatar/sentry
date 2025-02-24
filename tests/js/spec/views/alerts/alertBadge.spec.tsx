import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import AlertBadge from 'app/views/alerts/alertBadge';
import {IncidentStatus} from 'app/views/alerts/types';

describe('AlertBadge', () => {
  it('displays status', () => {
    mountWithTheme(<AlertBadge status={IncidentStatus.CLOSED} />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });
  it('hides status text', () => {
    mountWithTheme(<AlertBadge hideText status={IncidentStatus.CLOSED} />);
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
  });
  it('can be an issue badge', () => {
    mountWithTheme(<AlertBadge isIssue />);
    expect(screen.getByText('Issue')).toBeInTheDocument();
  });
});
