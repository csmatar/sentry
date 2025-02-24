import {PureComponent} from 'react';

import TeamSelector from 'app/components/forms/teamSelector';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import {Project, Team} from 'app/types';
import FormField from 'app/views/settings/components/forms/formField';
import TextField from 'app/views/settings/components/forms/textField';

type Props = {
  disabled: boolean;
  project: Project;
};

class RuleNameOwnerForm extends PureComponent<Props> {
  render() {
    const {disabled, project} = this.props;
    return (
      <Panel>
        <PanelBody>
          <TextField
            disabled={disabled}
            name="name"
            label={t('Rule Name')}
            help={t('Add a name so it’s easy to find later.')}
            placeholder={t('Something really bad happened')}
            required
          />

          <FormField
            name="owner"
            label={t('Team')}
            help={t('The team that can edit this alert.')}
            disabled={disabled}
          >
            {({model}) => {
              const owner = model.getValue('owner');
              const ownerId = owner && owner.split(':')[1];
              return (
                <TeamSelector
                  value={ownerId}
                  project={project}
                  onChange={({value}) => {
                    const ownerValue = value && `team:${value}`;
                    model.setValue('owner', ownerValue);
                  }}
                  teamFilter={(team: Team) => team.isMember || team.id === ownerId}
                  useId
                  includeUnassigned
                  disabled={disabled}
                />
              );
            }}
          </FormField>
        </PanelBody>
      </Panel>
    );
  }
}

export default RuleNameOwnerForm;
