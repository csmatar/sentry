import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import moment from 'moment';

import {disconnectIdentity} from 'app/actionCreators/account';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Tag from 'app/components/tag';
import {IconFlag} from 'app/icons';
import {t, tct} from 'app/locale';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {UserIdentityCategory, UserIdentityConfig, UserIdentityStatus} from 'app/types';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const ENDPOINT = '/users/me/user-identities/';

type Props = RouteComponentProps<{}, {}>;

type State = {
  identities: UserIdentityConfig[] | null;
} & AsyncView['state'];

class AccountIdentities extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      identities: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['identities', ENDPOINT]];
  }

  getTitle() {
    return t('Identities');
  }

  renderItem = (identity: UserIdentityConfig) => {
    return (
      <IdentityPanelItem key={`${identity.category}:${identity.id}`}>
        <InternalContainer>
          <PluginIcon pluginId={identity.provider.key} size={36} />
          <IdentityText isSingleLine={!identity.dateAdded}>
            <IdentityName>{identity.provider.name}</IdentityName>
            {identity.dateAdded && <IdentityDateTime date={moment(identity.dateAdded)} />}
          </IdentityText>
        </InternalContainer>
        <InternalContainer>
          <TagWrapper>
            {identity.category === UserIdentityCategory.SOCIAL_IDENTITY && (
              <Tag type="default">{t('Legacy')}</Tag>
            )}
            {identity.category !== UserIdentityCategory.ORG_IDENTITY && (
              <Tag type="default">
                {identity.isLogin ? t('Sign In') : t('Integration')}
              </Tag>
            )}
            {identity.organization && (
              <Tag type="highlight">{identity.organization.slug}</Tag>
            )}
          </TagWrapper>

          {this.renderButton(identity)}
        </InternalContainer>
      </IdentityPanelItem>
    );
  };

  renderButton(identity: UserIdentityConfig) {
    return identity.status === UserIdentityStatus.CAN_DISCONNECT ? (
      <Confirm
        onConfirm={() => this.handleDisconnect(identity)}
        priority="danger"
        confirmText={t('Disconnect')}
        message={
          <Fragment>
            <Alert type="error" icon={<IconFlag size="md" />}>
              {tct('Disconnect Your [provider] Identity?', {
                provider: identity.provider.name,
              })}
            </Alert>
            <TextBlock>
              {identity.isLogin
                ? t(
                    'After disconnecting, you will need to use a password or another identity to sign in.'
                  )
                : t("This action can't be undone.")}
            </TextBlock>
          </Fragment>
        }
      >
        <Button size="small">{t('Disconnect')}</Button>
      </Confirm>
    ) : (
      <Button
        size="small"
        disabled
        title={
          identity.status === UserIdentityStatus.NEEDED_FOR_GLOBAL_AUTH
            ? t(
                'You need this identity to sign into your account. If you want to disconnect it, set a password first.'
              )
            : identity.status === UserIdentityStatus.NEEDED_FOR_ORG_AUTH
            ? t('You need this identity to access your organization.')
            : null
        }
      >
        {t('Disconnect')}
      </Button>
    );
  }

  handleDisconnect = (identity: UserIdentityConfig) => {
    disconnectIdentity(identity, () => this.reloadData());
  };

  itemOrder = (a: UserIdentityConfig, b: UserIdentityConfig) => {
    function categoryRank(c: UserIdentityConfig) {
      return [
        UserIdentityCategory.GLOBAL_IDENTITY,
        UserIdentityCategory.SOCIAL_IDENTITY,
        UserIdentityCategory.ORG_IDENTITY,
      ].indexOf(c.category);
    }

    if (a.provider.name !== b.provider.name) {
      return a.provider.name < b.provider.name ? -1 : 1;
    }
    if (a.category !== b.category) {
      return categoryRank(a) - categoryRank(b);
    }
    if ((a.organization?.name ?? '') !== (b.organization?.name ?? '')) {
      return (a.organization?.name ?? '') < (b.organization?.name ?? '') ? -1 : 1;
    }
    return 0;
  };

  renderBody() {
    const appIdentities = this.state.identities
      ?.filter(identity => identity.category !== UserIdentityCategory.ORG_IDENTITY)
      .sort(this.itemOrder);
    const orgIdentities = this.state.identities
      ?.filter(identity => identity.category === UserIdentityCategory.ORG_IDENTITY)
      .sort(this.itemOrder);

    return (
      <Fragment>
        <SettingsPageHeader title="Identities" />

        <Panel>
          <PanelHeader>{t('Application Identities')}</PanelHeader>
          <PanelBody>
            {!appIdentities?.length ? (
              <EmptyMessage>
                {t(
                  'There are no application identities associated with your Sentry account'
                )}
              </EmptyMessage>
            ) : (
              appIdentities.map(this.renderItem)
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Organization Identities')}</PanelHeader>
          <PanelBody>
            {!orgIdentities?.length ? (
              <EmptyMessage>
                {t(
                  'There are no organization identities associated with your Sentry account'
                )}
              </EmptyMessage>
            ) : (
              orgIdentities.map(this.renderItem)
            )}
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}

const IdentityPanelItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

const InternalContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const IdentityText = styled('div')<{isSingleLine?: boolean}>`
  height: 36px;
  display: flex;
  flex-direction: column;
  justify-content: ${p => (p.isSingleLine ? 'center' : 'space-between')};
  margin-left: ${space(1.5)};
`;
const IdentityName = styled('div')`
  font-weight: bold;
`;
const IdentityDateTime = styled(DateTime)`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  color: ${p => p.theme.subText};
`;

const TagWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-grow: 1;
  margin-right: ${space(1)};
`;

export default AccountIdentities;
