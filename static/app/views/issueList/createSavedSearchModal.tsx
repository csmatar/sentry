import * as React from 'react';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {createSavedSearch} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import {Form, SelectField, TextField} from 'app/views/settings/components/forms';
import {OnSubmitCallback} from 'app/views/settings/components/forms/type';

import {getSortLabel, IssueSortOptions} from './utils';

type Props = ModalRenderProps & {
  api: Client;
  query: string;
  sort?: string;
  organization: Organization;
};

type State = {
  isSaving: boolean;
  error: string | null;
};

const DEFAULT_SORT_OPTIONS = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.FREQ,
  IssueSortOptions.PRIORITY,
  IssueSortOptions.USER,
];

class CreateSavedSearchModal extends React.Component<Props, State> {
  state: State = {
    isSaving: false,
    error: null,
  };

  /** Handle "date added" sort not being available for saved searches */
  validateSortOption(sort?: string | null): string {
    if (this.sortOptions().find(option => option === sort)) {
      return sort as string;
    }

    return IssueSortOptions.DATE;
  }

  handleSubmit: OnSubmitCallback = (data, onSubmitSuccess, onSubmitError, event) => {
    const {api, organization} = this.props;
    const sort = this.validateSortOption(data.sort);

    event.preventDefault();

    this.setState({isSaving: true});

    addLoadingMessage(t('Saving Changes'));

    createSavedSearch(api, organization.slug, data.name, data.query, sort)
      .then(_data => {
        this.props.closeModal();
        this.setState({
          error: null,
          isSaving: false,
        });
        clearIndicators();
        onSubmitSuccess(data);
      })
      .catch(err => {
        let error = t('Unable to save your changes.');
        if (err.responseJSON && err.responseJSON.detail) {
          error = err.responseJSON.detail;
        }
        this.setState({
          error,
          isSaving: false,
        });
        clearIndicators();
        onSubmitError(error);
      });
  };

  sortOptions() {
    const {organization} = this.props;
    const options = [...DEFAULT_SORT_OPTIONS];
    if (organization?.features?.includes('issue-list-trend-sort')) {
      options.push(IssueSortOptions.TREND);
    }

    return options;
  }

  render() {
    const {error} = this.state;
    const {Header, Body, closeModal, query, sort} = this.props;

    const sortOptions = this.sortOptions().map(sortOption => ({
      value: sortOption,
      label: getSortLabel(sortOption),
    }));
    const initialData = {
      name: '',
      query,
      sort: this.validateSortOption(sort),
    };

    return (
      <Form
        onSubmit={this.handleSubmit}
        onCancel={closeModal}
        saveOnBlur={false}
        initialData={initialData}
        submitLabel={t('Save')}
      >
        <Header>
          <h4>{t('Save Current Search')}</h4>
        </Header>

        <Body>
          {this.state.error && <Alert type="error">{error}</Alert>}

          <p>{t('All team members will now have access to this search.')}</p>
          <TextField
            key="name"
            name="name"
            label={t('Name')}
            placeholder="e.g. My Search Results"
            inline={false}
            stacked
            flexibleControlStateSize
            required
          />
          <TextField
            key="query"
            name="query"
            label={t('Query')}
            inline={false}
            stacked
            flexibleControlStateSize
            required
          />
          <SelectField
            key="sort"
            name="sort"
            label={t('Sort By')}
            options={sortOptions}
            required
            clearable={false}
            inline={false}
            stacked
            flexibleControlStateSize
          />
        </Body>
      </Form>
    );
  }
}

export default withApi(CreateSavedSearchModal);
