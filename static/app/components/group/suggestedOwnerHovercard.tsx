import * as React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import Alert from 'app/components/alert';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import Button from 'app/components/button';
import Hovercard from 'app/components/hovercard';
import Link from 'app/components/links/link';
import {IconCommit, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Actor, Commit} from 'app/types';
import {defined} from 'app/utils';
import theme from 'app/utils/theme';

type Props = {
  /**
   * The suggested actor.
   */
  actor: Actor;
  /**
   * The list of commits the actor is suggested for. May be left blank if the
   * actor is not suggested for commits.
   */
  commits?: Commit[];
  /**
   * The list of ownership rules the actor is suggested for. May be left blank
   * if the actor is not suggested based on ownership rules.
   */
  rules?: any[] | null;
};

type State = {
  commitsExpanded: boolean;
  rulesExpanded: boolean;
};

class SuggestedOwnerHovercard extends React.Component<Props, State> {
  state: State = {
    commitsExpanded: false,
    rulesExpanded: false,
  };

  render() {
    const {actor, commits, rules, ...props} = this.props;
    const {commitsExpanded, rulesExpanded} = this.state;
    const modalData = {
      initialData: [
        {
          emails: actor.email ? new Set([actor.email]) : new Set([]),
        },
      ],
      source: 'suggested_assignees',
    };

    return (
      <Hovercard
        header={
          <React.Fragment>
            <HovercardHeader>
              <HovercardActorAvatar actor={actor} />
              {actor.name || actor.email}
            </HovercardHeader>
            {actor.id === undefined && (
              <EmailAlert icon={<IconWarning size="xs" />} type="warning">
                {tct(
                  'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
                  {
                    actorEmail: <strong>{actor.email}</strong>,
                    accountSettings: <Link to="/settings/account/emails/" />,
                    inviteUser: <a onClick={() => openInviteMembersModal(modalData)} />,
                  }
                )}
              </EmailAlert>
            )}
          </React.Fragment>
        }
        body={
          <HovercardBody>
            {commits !== undefined && (
              <React.Fragment>
                <div className="divider">
                  <h6>{t('Commits')}</h6>
                </div>
                <div>
                  {commits
                    .slice(0, commitsExpanded ? commits.length : 3)
                    .map(({message, dateCreated}, i) => (
                      <CommitReasonItem key={i}>
                        <CommitIcon />
                        <CommitMessage
                          message={message ?? undefined}
                          date={dateCreated}
                        />
                      </CommitReasonItem>
                    ))}
                </div>
                {commits.length > 3 && !commitsExpanded ? (
                  <ViewMoreButton
                    onClick={() => this.setState({commitsExpanded: true})}
                  />
                ) : null}
              </React.Fragment>
            )}
            {defined(rules) && (
              <React.Fragment>
                <div className="divider">
                  <h6>{t('Matching Ownership Rules')}</h6>
                </div>
                <div>
                  {rules
                    .slice(0, rulesExpanded ? rules.length : 3)
                    .map(([type, matched], i) => (
                      <RuleReasonItem key={i}>
                        <OwnershipTag tagType={type} />
                        <OwnershipValue>{matched}</OwnershipValue>
                      </RuleReasonItem>
                    ))}
                </div>
                {rules.length > 3 && !rulesExpanded ? (
                  <ViewMoreButton onClick={() => this.setState({rulesExpanded: true})} />
                ) : null}
              </React.Fragment>
            )}
          </HovercardBody>
        }
        {...props}
      />
    );
  }
}

const tagColors = {
  url: theme.green200,
  path: theme.purple300,
  tag: theme.blue300,
  codeowners: theme.pink300,
};

const CommitIcon = styled(IconCommit)`
  margin-right: ${space(0.5)};
  flex-shrink: 0;
`;

const CommitMessage = styled(({message = '', date, ...props}) => (
  <div {...props}>
    {message.split('\n')[0]}
    <CommitDate date={date} />
  </div>
))`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  margin-top: ${space(0.25)};
  hyphens: auto;
`;

const CommitDate = styled(({date, ...props}) => (
  <div {...props}>{moment(date).fromNow()}</div>
))`
  margin-top: ${space(0.5)};
  color: ${p => p.theme.gray300};
`;

const CommitReasonItem = styled('div')`
  display: flex;
  align-items: flex-start;

  &:not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const RuleReasonItem = styled('code')`
  display: flex;
  align-items: flex-start;

  &:not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const OwnershipTag = styled(({tagType, ...props}) => <div {...props}>{tagType}</div>)`
  background: ${p => tagColors[p.tagType.indexOf('tags') === -1 ? p.tagType : 'tag']};
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.25)} ${space(0.5)};
  margin: ${space(0.25)} ${space(0.5)} ${space(0.25)} 0;
  border-radius: 2px;
  font-weight: bold;
  text-align: center;
`;

const ViewMoreButton = styled((p: React.ComponentProps<typeof Button>) => (
  <Button {...p} priority="link" size="zero">
    {t('View more')}
  </Button>
))`
  border: none;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.25)} ${space(0.5)};
  margin: ${space(1)} ${space(0.25)} ${space(0.25)} 0;
  width: 100%;
  min-width: 34px;
`;

const OwnershipValue = styled('code')`
  word-break: break-all;
  line-height: 1.2;
`;

const EmailAlert = styled(Alert)`
  margin: 10px -13px -13px;
  border-radius: 0;
  border-color: #ece0b0;
  padding: 10px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
  box-shadow: none;
`;

const HovercardHeader = styled('div')`
  display: flex;
  align-items: center;
`;

const HovercardActorAvatar = styled(p => (
  <ActorAvatar size={20} hasTooltip={false} {...p} />
))`
  margin-right: ${space(1)};
`;

const HovercardBody = styled('div')`
  margin-top: -${space(2)};
`;

export default SuggestedOwnerHovercard;
