import * as React from 'react';
import {Mention, MentionsInput, MentionsInputProps} from 'react-mentions';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import NavTabs from 'app/components/navTabs';
import {IconMarkdown} from 'app/icons';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import textStyles from 'app/styles/text';
import {NoteType} from 'app/types/alerts';
import marked from 'app/utils/marked';
import {Theme} from 'app/utils/theme';

import Mentionables from './mentionables';
import mentionStyle from './mentionStyle';
import {CreateError, Mentionable, MentionChangeEvent, Mentioned} from './types';

const defaultProps = {
  placeholder: t('Add a comment.\nTag users with @, or teams with #'),
  minHeight: 140,
  busy: false,
};

type Props = {
  teams: Mentionable[];
  memberList: Mentionable[];
  /**
   * This is the id of the note object from the server
   * This is to indicate you are editing an existing item
   */
  modelId?: string;
  /**
   * The note text itself
   */
  text?: string;
  error?: boolean;
  errorJSON?: CreateError | null;
  onEditFinish?: () => void;
  onUpdate?: (data: NoteType) => void;
  onCreate?: (data: NoteType) => void;
  onChange?: (e: MentionChangeEvent, extra: {updating?: boolean}) => void;
  theme: Theme;
} & typeof defaultProps;

type State = {
  preview: boolean;
  value: string;
  memberMentions: Mentioned[];
  teamMentions: Mentioned[];
};

class NoteInputComponent extends React.Component<Props, State> {
  state: State = {
    preview: false,
    value: this.props.text || '',
    memberMentions: [],
    teamMentions: [],
  };

  get canSubmit() {
    return this.state.value.trim() !== '';
  }

  cleanMarkdown(text: string) {
    return text
      .replace(/\[sentry\.strip:member\]/g, '@')
      .replace(/\[sentry\.strip:team\]/g, '');
  }

  submitForm() {
    if (!!this.props.modelId) {
      this.update();
      return;
    }
    this.create();
  }

  create() {
    const {onCreate} = this.props;

    if (onCreate) {
      onCreate({
        text: this.cleanMarkdown(this.state.value),
        mentions: this.finalizeMentions(),
      });
    }
  }

  update() {
    const {onUpdate} = this.props;

    if (onUpdate) {
      onUpdate({
        text: this.cleanMarkdown(this.state.value),
        mentions: this.finalizeMentions(),
      });
    }
  }

  finish() {
    this.props.onEditFinish && this.props.onEditFinish();
  }

  finalizeMentions(): string[] {
    const {memberMentions, teamMentions} = this.state;

    // each mention looks like [id, display]
    return [...memberMentions, ...teamMentions]
      .filter(mention => this.state.value.indexOf(mention[1]) !== -1)
      .map(mention => mention[0]);
  }

  handleToggleEdit = () => {
    this.setState({preview: false});
  };

  handleTogglePreview = () => {
    this.setState({preview: true});
  };

  handleSubmit = (e: React.MouseEvent<HTMLFormElement>) => {
    e.preventDefault();
    this.submitForm();
  };

  handleChange: MentionsInputProps['onChange'] = e => {
    this.setState({value: e.target.value});

    if (this.props.onChange) {
      this.props.onChange(e, {updating: !!this.props.modelId});
    }
  };

  handleKeyDown: MentionsInputProps['onKeyDown'] = e => {
    // Auto submit the form on [meta,ctrl] + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && this.canSubmit) {
      this.submitForm();
    }
  };

  handleCancel = (e: React.MouseEvent<Element>) => {
    e.preventDefault();
    this.finish();
  };

  handleAddMember = (id: React.ReactText, display: string) => {
    this.setState(({memberMentions}) => ({
      memberMentions: [...memberMentions, [`${id}`, display]],
    }));
  };

  handleAddTeam = (id: React.ReactText, display: string) => {
    this.setState(({teamMentions}) => ({
      teamMentions: [...teamMentions, [`${id}`, display]],
    }));
  };

  render() {
    const {preview, value} = this.state;
    const {modelId, busy, placeholder, minHeight, errorJSON, memberList, teams, theme} =
      this.props;

    const existingItem = !!modelId;
    const btnText = existingItem ? t('Save Comment') : t('Post Comment');

    const errorMessage =
      (errorJSON &&
        (typeof errorJSON.detail === 'string'
          ? errorJSON.detail
          : (errorJSON.detail && errorJSON.detail.message) ||
            t('Unable to post comment'))) ||
      null;

    return (
      <NoteInputForm
        data-test-id="note-input-form"
        noValidate
        onSubmit={this.handleSubmit}
      >
        <NoteInputNavTabs>
          <NoteInputNavTab className={!preview ? 'active' : ''}>
            <NoteInputNavTabLink onClick={this.handleToggleEdit}>
              {existingItem ? t('Edit') : t('Write')}
            </NoteInputNavTabLink>
          </NoteInputNavTab>
          <NoteInputNavTab className={preview ? 'active' : ''}>
            <NoteInputNavTabLink onClick={this.handleTogglePreview}>
              {t('Preview')}
            </NoteInputNavTabLink>
          </NoteInputNavTab>
          <MarkdownTab>
            <IconMarkdown />
            <MarkdownSupported>{t('Markdown supported')}</MarkdownSupported>
          </MarkdownTab>
        </NoteInputNavTabs>

        <NoteInputBody>
          {preview ? (
            <NotePreview
              minHeight={minHeight}
              dangerouslySetInnerHTML={{__html: marked(this.cleanMarkdown(value))}}
            />
          ) : (
            <MentionsInput
              style={mentionStyle({theme, minHeight})}
              placeholder={placeholder}
              onChange={this.handleChange}
              onKeyDown={this.handleKeyDown}
              value={value}
              required
              autoFocus
            >
              <Mention
                trigger="@"
                data={memberList}
                onAdd={this.handleAddMember}
                displayTransform={(_id, display) => `@${display}`}
                markup="**[sentry.strip:member]__display__**"
                appendSpaceOnAdd
              />
              <Mention
                trigger="#"
                data={teams}
                onAdd={this.handleAddTeam}
                markup="**[sentry.strip:team]__display__**"
                appendSpaceOnAdd
              />
            </MentionsInput>
          )}
        </NoteInputBody>

        <Footer>
          <div>{errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}</div>
          <div>
            {existingItem && (
              <FooterButton priority="danger" type="button" onClick={this.handleCancel}>
                {t('Cancel')}
              </FooterButton>
            )}
            <FooterButton
              error={errorMessage}
              type="submit"
              disabled={busy || !this.canSubmit}
            >
              {btnText}
            </FooterButton>
          </div>
        </Footer>
      </NoteInputForm>
    );
  }
}

const NoteInput = withTheme(NoteInputComponent);

type NoteInputContainerProps = {
  projectSlugs: string[];
} & Omit<Props, 'memberList' | 'teams' | 'theme'>;

type MentionablesChildFunc = Parameters<
  React.ComponentProps<typeof Mentionables>['children']
>[0];

class NoteInputContainer extends React.Component<NoteInputContainerProps> {
  static defaultProps = defaultProps;

  renderInput = ({members, teams}: MentionablesChildFunc) => {
    const {projectSlugs: _, ...props} = this.props;
    return <NoteInput memberList={members} teams={teams} {...props} />;
  };

  render() {
    const {projectSlugs} = this.props;
    const me = ConfigStore.get('user');

    return (
      <Mentionables me={me} projectSlugs={projectSlugs}>
        {this.renderInput}
      </Mentionables>
    );
  }
}

export default NoteInputContainer;

type NotePreviewProps = {
  minHeight: Props['minHeight'];
  theme: Props['theme'];
};
// This styles both the note preview and the note editor input
const getNotePreviewCss = (p: NotePreviewProps) => {
  const {minHeight, padding, overflow, border} = mentionStyle(p)['&multiLine'].input;

  return `
  max-height: 1000px;
  max-width: 100%;
  ${(minHeight && `min-height: ${minHeight}px`) || ''};
  padding: ${padding};
  overflow: ${overflow};
  border: ${border};
`;
};

const getNoteInputErrorStyles = (p: {error?: string; theme: Theme}) => {
  if (!p.error) {
    return '';
  }

  return `
  color: ${p.theme.error};
  margin: -1px;
  border: 1px solid ${p.theme.error};
  border-radius: ${p.theme.borderRadius};

    &:before {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-right: 7px solid ${p.theme.red300};
      position: absolute;
      left: -7px;
      top: 12px;
    }

    &:after {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-right: 6px solid #fff;
      position: absolute;
      left: -5px;
      top: 12px;
    }
  `;
};

const NoteInputForm = styled('form')<{error?: string}>`
  font-size: 15px;
  line-height: 22px;
  transition: padding 0.2s ease-in-out;

  ${p => getNoteInputErrorStyles(p)}
`;

const NoteInputBody = styled('div')`
  ${textStyles}
`;

const Footer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  justify-content: space-between;
  transition: opacity 0.2s ease-in-out;
  padding-left: ${space(1.5)};
`;

type FooterButtonProps = {
  error?: string | null;
} & React.ComponentProps<typeof Button>;

const FooterButton = styled(Button)<FooterButtonProps>`
  font-size: 13px;
  margin: -1px -1px -1px;
  border-radius: 0 0 ${p => p.theme.borderRadius};

  ${p =>
    p.error &&
    `
  &, &:active, &:focus, &:hover {
  border-bottom-color: ${p.theme.error};
  border-right-color: ${p.theme.error};
  }
  `}
`;

const ErrorMessage = styled('span')`
  display: flex;
  align-items: center;
  height: 100%;
  color: ${p => p.theme.error};
  font-size: 0.9em;
`;

const NoteInputNavTabs = styled(NavTabs)`
  padding: ${space(1)} ${space(2)} 0;
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: 0;
`;

const NoteInputNavTab = styled('li')`
  margin-right: 13px;
`;

const NoteInputNavTabLink = styled('a')`
  .nav-tabs > li > & {
    font-size: 15px;
    padding-bottom: 5px;
  }
`;
const MarkdownTab = styled(NoteInputNavTab)`
  .nav-tabs > & {
    display: flex;
    align-items: center;
    margin-right: 0;
    color: ${p => p.theme.subText};

    float: right;
  }
`;

const MarkdownSupported = styled('span')`
  margin-left: ${space(0.5)};
  font-size: 14px;
`;

const NotePreview = styled('div')<{minHeight: Props['minHeight']}>`
  ${p => getNotePreviewCss(p)};
  padding-bottom: ${space(1)};
`;
