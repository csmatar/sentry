import styled from '@emotion/styled';

import {t} from 'app/locale';

import ReleasesDropdown from './releasesDropdown';

export enum ReleasesDisplayOption {
  USERS = 'users',
  SESSIONS = 'sessions',
}

const displayOptions = {
  [ReleasesDisplayOption.SESSIONS]: {label: t('Sessions')},
  [ReleasesDisplayOption.USERS]: {label: t('Users')},
};

type Props = {
  selected: ReleasesDisplayOption;
  onSelect: (key: string) => void;
};

function ReleasesDisplayOptions({selected, onSelect}: Props) {
  return (
    <StyledReleasesDropdown
      label={t('Display')}
      options={displayOptions}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleasesDisplayOptions;

const StyledReleasesDropdown = styled(ReleasesDropdown)`
  z-index: 1;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    order: 3;
  }
`;
