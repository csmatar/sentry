import styled from '@emotion/styled';

import DashLeft from 'sentry-images/spot/dashboards-banner-left.svg';
import DashRight from 'sentry-images/spot/dashboards-banner-right.svg';

import Banner from 'app/components/banner';
import Button from 'app/components/button';
import {t} from 'app/locale';

type Props = {
  onHideBanner: () => void;
};

function DashboardBanner({onHideBanner}: Props) {
  return (
    <StyledBanner
      title={t('Customize Dashboards')}
      subtitle={t('Build your own widgets and manage multiple dashboards')}
      onCloseClick={onHideBanner}
      backgroundComponent={<DashboardBackground />}
    >
      <Button>{t('Read the docs')}</Button>
      <Button priority="primary">{t('Upgrade plan')}</Button>
    </StyledBanner>
  );
}

const StyledBanner = styled(Banner)`
  background-color: ${p => p.theme.purple100};
  color: ${p => p.theme.textColor};
`;

const DashboardBackground = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    background-image: url(${DashLeft}), url(${DashRight});
    background-position: left center, right center;
    background-repeat: no-repeat, no-repeat;
    background-size: 20% 100%, 20% 100%;
    height: 95%;
    width: 95%;
  }
`;

export default DashboardBanner;
