import LazyLoad from 'react-lazyload';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import MiniBarChart from 'app/components/charts/miniBarChart';
import Count from 'app/components/count';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Link from 'app/components/links/link';
import NotAvailable from 'app/components/notAvailable';
import {extractSelectionParameters} from 'app/components/organizations/globalSelectionHeader/utils';
import {PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import Tag from 'app/components/tag';
import Tooltip from 'app/components/tooltip';
import {t, tn} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Release, ReleaseProject} from 'app/types';
import {defined} from 'app/utils';
import {getCrashFreeIcon} from 'app/utils/sessions';

import {
  ADOPTION_STAGE_LABELS,
  displayCrashFreePercent,
  getReleaseNewIssuesUrl,
  getReleaseUnhandledIssuesUrl,
  isMobileRelease,
} from '../../utils';
import {ReleasesDisplayOption} from '../releasesDisplayOptions';
import {ReleasesRequestRenderProps} from '../releasesRequest';

import {
  AdoptionColumn,
  AdoptionStageColumn,
  CrashesColumn,
  CrashFreeRateColumn,
  NewIssuesColumn,
  ReleaseProjectColumn,
  ReleaseProjectsLayout,
} from '.';

type Props = {
  index: number;
  organization: Organization;
  project: ReleaseProject;
  location: Location;
  getHealthData: ReleasesRequestRenderProps['getHealthData'];
  releaseVersion: string;
  activeDisplay: ReleasesDisplayOption;
  showPlaceholders: boolean;
  showReleaseAdoptionStages: boolean;
  isTopRelease: boolean;
  adoptionStages?: Release['adoptionStages'];
};

function ReleaseCardProjectRow({
  index,
  project,
  organization,
  location,
  getHealthData,
  releaseVersion,
  activeDisplay,
  showPlaceholders,
  showReleaseAdoptionStages,
  isTopRelease,
  adoptionStages,
}: Props) {
  const theme = useTheme();
  const {id, newGroups} = project;

  const crashCount = getHealthData.getCrashCount(
    releaseVersion,
    id,
    ReleasesDisplayOption.SESSIONS
  );
  const crashFreeRate = getHealthData.getCrashFreeRate(releaseVersion, id, activeDisplay);
  const get24hCountByProject = getHealthData.get24hCountByProject(id, activeDisplay);
  const timeSeries = getHealthData.getTimeSeries(releaseVersion, id, activeDisplay);
  const adoption = getHealthData.getAdoption(releaseVersion, id, activeDisplay);

  const adoptionStage =
    showReleaseAdoptionStages &&
    adoptionStages?.[project.slug] &&
    adoptionStages?.[project.slug].stage;

  const adoptionStageLabel =
    Boolean(get24hCountByProject && adoptionStage && isMobileRelease(project.platform)) &&
    ADOPTION_STAGE_LABELS[adoptionStage];

  return (
    <ProjectRow>
      <ReleaseProjectsLayout showReleaseAdoptionStages={showReleaseAdoptionStages}>
        <ReleaseProjectColumn>
          <ProjectBadge project={project} avatarSize={16} />
        </ReleaseProjectColumn>

        {showReleaseAdoptionStages && (
          <AdoptionStageColumn>
            {adoptionStageLabel ? (
              <Link
                to={{
                  pathname: `/organizations/${organization.slug}/releases/`,
                  query: {
                    ...location.query,
                    query: `release.stage:${adoptionStage}`,
                  },
                }}
              >
                <Tooltip title={adoptionStageLabel.tooltipTitle}>
                  <Tag type={adoptionStageLabel.type}>{adoptionStageLabel.name}</Tag>
                </Tooltip>
              </Link>
            ) : (
              <NotAvailable />
            )}
          </AdoptionStageColumn>
        )}

        <AdoptionColumn>
          {showPlaceholders ? (
            <StyledPlaceholder width="100px" />
          ) : (
            <AdoptionWrapper>
              <span>{adoption ? Math.round(adoption) : '0'}%</span>
              <LazyLoad debounce={50} height={20}>
                <MiniBarChart
                  series={timeSeries}
                  height={20}
                  isGroupedByDate
                  showTimeInTooltip
                  hideDelay={50}
                  tooltipFormatter={(value: number) => {
                    const suffix =
                      activeDisplay === ReleasesDisplayOption.USERS
                        ? tn('user', 'users', value)
                        : tn('session', 'sessions', value);

                    return `${value.toLocaleString()} ${suffix}`;
                  }}
                  colors={[theme.purple300, theme.gray200]}
                />
              </LazyLoad>
            </AdoptionWrapper>
          )}
        </AdoptionColumn>

        <CrashFreeRateColumn>
          {showPlaceholders ? (
            <StyledPlaceholder width="60px" />
          ) : defined(crashFreeRate) ? (
            <CrashFreeWrapper>
              {getCrashFreeIcon(crashFreeRate)}
              {displayCrashFreePercent(crashFreeRate)}
            </CrashFreeWrapper>
          ) : (
            <NotAvailable />
          )}
        </CrashFreeRateColumn>

        <CrashesColumn>
          {showPlaceholders ? (
            <StyledPlaceholder width="30px" />
          ) : defined(crashCount) ? (
            <Tooltip title={t('Open in Issues')}>
              <GlobalSelectionLink
                to={getReleaseUnhandledIssuesUrl(
                  organization.slug,
                  project.id,
                  releaseVersion
                )}
              >
                <Count value={crashCount} />
              </GlobalSelectionLink>
            </Tooltip>
          ) : (
            <NotAvailable />
          )}
        </CrashesColumn>

        <NewIssuesColumn>
          <Tooltip title={t('Open in Issues')}>
            <GlobalSelectionLink
              to={getReleaseNewIssuesUrl(organization.slug, project.id, releaseVersion)}
            >
              <Count value={newGroups || 0} />
            </GlobalSelectionLink>
          </Tooltip>
        </NewIssuesColumn>

        <ViewColumn>
          <GuideAnchor disabled={!isTopRelease || index !== 0} target="view_release">
            <Button
              size="xsmall"
              to={{
                pathname: `/organizations/${
                  organization.slug
                }/releases/${encodeURIComponent(releaseVersion)}/`,
                query: {
                  ...extractSelectionParameters(location.query),
                  project: project.id,
                  yAxis: undefined,
                },
              }}
            >
              {t('View')}
            </Button>
          </GuideAnchor>
        </ViewColumn>
      </ReleaseProjectsLayout>
    </ProjectRow>
  );
}

export default ReleaseCardProjectRow;

const ProjectRow = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 15px;
  display: inline-block;
  position: relative;
  top: ${space(0.25)};
`;

const AdoptionWrapper = styled('span')`
  flex: 1;
  display: inline-grid;
  grid-template-columns: 30px 1fr;
  grid-gap: ${space(1)};
  align-items: center;

  /* Chart tooltips need overflow */
  overflow: visible;
`;

const CrashFreeWrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(1)};
  align-items: center;
  vertical-align: middle;
`;

const ViewColumn = styled('div')`
  ${overflowEllipsis};
  line-height: 20px;
  text-align: right;
`;
