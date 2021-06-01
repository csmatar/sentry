import {Organization, Project} from 'app/types';
import * as AppStoreConnectContext from 'app/views/settings/project/appStoreConnectContext';

import UpdateAlert from './updateAlert';

type Props = Pick<
  React.ComponentProps<typeof UpdateAlert>,
  'isCompact' | 'className' | 'Wrapper'
> & {
  organization: Organization;
  project?: Project;
};

function GlobalAppStoreConnectUpdateAlert({project, organization, ...rest}: Props) {
  return (
    <AppStoreConnectContext.Provider project={project} orgSlug={organization.slug}>
      <UpdateAlert project={project} organization={organization} {...rest} />
    </AppStoreConnectContext.Provider>
  );
}

export default GlobalAppStoreConnectUpdateAlert;
