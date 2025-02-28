import {useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

import {switchOrganization} from 'app/actionCreators/organizations';
import OrganizationContextContainer from 'app/views/organizationContext';

import Body from './body';

type Props = RouteComponentProps<{orgId: string}, {}> &
  Partial<React.ComponentProps<typeof OrganizationContextContainer>>;

function OrganizationDetails({children, ...props}: Props) {
  // Switch organizations when the orgId changes
  useEffect(() => void switchOrganization(), [props.params.orgId]);

  return (
    <OrganizationContextContainer includeSidebar useLastOrganization {...props}>
      <Body>{children}</Body>
    </OrganizationContextContainer>
  );
}

export default OrganizationDetails;
