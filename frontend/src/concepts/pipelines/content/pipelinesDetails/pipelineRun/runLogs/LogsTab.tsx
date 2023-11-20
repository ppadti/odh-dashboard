import React, { useEffect } from 'react';
import {
  Button,
  Tooltip,
  TextListItem,
  TextListItemVariants,
  TextContent,
  Spinner,
  Stack,
  StackItem,
  Split,
  SplitItem,
  Bullseye,
  Truncate,
  ToolbarContent,
  Toolbar,
} from '@patternfly/react-core';
import {
  Dropdown,
  DropdownItem,
  DropdownToggle,
  KebabToggle,
} from '@patternfly/react-core/deprecated';
import OutlinedPlayCircleIcon from '@patternfly/react-icons/dist/esm/icons/outlined-play-circle-icon';
import PauseIcon from '@patternfly/react-icons/dist/esm/icons/pause-icon';
import PlayIcon from '@patternfly/react-icons/dist/esm/icons/play-icon';
import DownloadIcon from '@patternfly/react-icons/dist/esm/icons/download-icon';
import { LogViewer, LogViewerSearch } from '@patternfly/react-log-viewer';
import { CompressIcon, ExpandIcon } from '@patternfly/react-icons';
import DashboardLogViewer from '~/concepts/dashboard/DashboardLogViewer';
import { PipelineRunTaskDetails } from '~/concepts/pipelines/content/types';
import SimpleDropdownSelect from '~/components/SimpleDropdownSelect';
import useFetchLogs from '~/concepts/k8s/pods/useFetchLogs';
import usePodContainerLogState from '~/concepts/pipelines/content/pipelinesDetails/pipelineRun/runLogs/usePodContainerLogState';
import { useWindowResize } from '~/concepts/pipelines/content/pipelinesDetails/pipelineRun/runLogs/useWindowResize';
import LogsTabStatus from '~/concepts/pipelines/content/pipelinesDetails/pipelineRun/runLogs/LogsTabStatus';
import { LOG_TAIL_LINES } from '~/concepts/pipelines/content/pipelinesDetails/pipelineRun/runLogs/const';
import { downloadFullPodLog, downloadAllStepLogs } from '~/concepts/k8s/pods/utils';
import { usePipelinesAPI } from '~/concepts/pipelines/context';

// TODO: If this gets large enough we should look to make this its own component file
const LogsTab: React.FC<{ task: PipelineRunTaskDetails }> = ({ task }) => {
  const podName = task.runDetails?.status.podName;

  if (!podName) {
    return <>No content</>;
  }

  return <LogsTabForPodName podName={podName} />;
};

/** Must be a non-empty podName -- use LogsTabForTask for safer usage */
const LogsTabForPodName: React.FC<{ podName: string }> = ({ podName }) => {
  const { namespace } = usePipelinesAPI();
  const { podLoaded, podError, podContainers, selectedContainer, setSelectedContainer } =
    usePodContainerLogState(podName);
  const [isPaused, setIsPaused] = React.useState(false);
  const [logs, logsLoaded, logsError, refreshLogs] = useFetchLogs(
    podName,
    selectedContainer?.name ?? '',
    !isPaused,
    LOG_TAIL_LINES,
  );
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<Error | undefined>();
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = React.useState(false);
  const { isSmallScreen } = useWindowResize();
  const logViewerRef = React.useRef<{ scrollToBottom: () => void }>();
  const [isFullScreen, setIsFullScreen] = React.useState(false);

  React.useEffect(() => {
    if (!isPaused && logs) {
      if (logViewerRef && logViewerRef.current) {
        logViewerRef.current.scrollToBottom();
      }
    }
  }, [isPaused, logs]);

  const onScroll: React.ComponentProps<typeof LogViewer>['onScroll'] = ({
    scrollOffsetToBottom,
    scrollUpdateWasRequested,
  }) => {
    if (!scrollUpdateWasRequested) {
      if (scrollOffsetToBottom > 0) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    }
  };

  const canDownloadAll = !!podContainers && !!podName && !downloading;
  const onDownloadAll = () => {
    if (!canDownloadAll) {
      return;
    }
    setDownloadError(undefined);
    setDownloading(true);
    downloadAllStepLogs(podContainers, namespace, podName)
      .catch((e) => setDownloadError(e))
      .finally(() => setDownloading(false));
  };

  const canDownload = !!selectedContainer && !!podName && !downloading;
  const onDownload = () => {
    if (!canDownload) {
      return;
    }
    setDownloadError(undefined);
    setDownloading(true);
    downloadFullPodLog(namespace, podName, selectedContainer.name)
      .catch((e) => setDownloadError(e))
      .finally(() => setDownloading(false));
  };

  const handleFullScreen = () => {
    setIsFullScreen(!!document.fullscreenElement);
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullScreen);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreen);
    };
  }, [isFullScreen]);

  const onExpandClick = () => {
    const element = document.querySelector('#complex-toolbar-demo');

    if (!isFullScreen) {
      if (element?.requestFullscreen) {
        element.requestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  const error = podError || logsError || downloadError;
  const loaded = podLoaded && logsLoaded;

  let data: string;
  if (error) {
    data = '';
  } else if (!logsLoaded) {
    data = 'Loading...';
  } else if (logs) {
    data = logs;
  } else {
    data = 'No content';
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <LogsTabStatus
          loaded={loaded}
          error={error}
          refresh={refreshLogs}
          onDownload={onDownloadAll}
        />
      </StackItem>
      <StackItem isFilled id="complex-toolbar-demo">
        <DashboardLogViewer
          data={data}
          logViewerRef={logViewerRef}
          toolbar={
            <Toolbar className="pf-v5-u-p-sm">
              <ToolbarContent>
                <Split hasGutter isWrappable style={{ width: '100%' }}>
                  <SplitItem>
                    <Split hasGutter>
                      {isSmallScreen() ? null : (
                        <SplitItem>
                          <Bullseye>
                            <TextContent>
                              <TextListItem component={TextListItemVariants.dt}>Step</TextListItem>
                            </TextContent>
                          </Bullseye>
                        </SplitItem>
                      )}
                      <SplitItem>
                        <SimpleDropdownSelect
                          isDisabled={podContainers.length === 0}
                          options={podContainers.map((container) => ({
                            key: container.name,
                            label: container.name,
                          }))}
                          value={selectedContainer?.name ?? ''}
                          placeholder="Select container..."
                          onChange={(v) => {
                            setSelectedContainer(podContainers.find((c) => c.name === v) ?? null);
                          }}
                          width={150}
                        />
                      </SplitItem>
                      <SplitItem>
                        <LogViewerSearch
                          onFocus={() => setIsPaused(true)}
                          placeholder="Search"
                          minSearchChars={0}
                        />
                      </SplitItem>
                    </Split>
                  </SplitItem>
                  <SplitItem>
                    <Button
                      variant={!logsLoaded ? 'plain' : isPaused ? 'plain' : 'link'}
                      onClick={() => setIsPaused(!isPaused)}
                      isDisabled={!!error}
                    >
                      {error ? (
                        'Error loading logs'
                      ) : !logsLoaded ? (
                        <>
                          <Spinner size="sm" /> {isSmallScreen() ? 'Loading' : 'Loading log'}
                        </>
                      ) : isPaused ? (
                        <>
                          <PlayIcon /> {isSmallScreen() ? 'Resume' : 'Resume refreshing'}
                        </>
                      ) : (
                        <>
                          <PauseIcon /> {isSmallScreen() ? 'Pause' : 'Pause refreshing'}
                        </>
                      )}
                    </Button>
                  </SplitItem>
                  <SplitItem isFilled style={{ textAlign: 'right' }}>
                    {downloading ? (
                      <>
                        <Spinner size="sm" />{' '}
                      </>
                    ) : null}
                    {podContainers.length !== 0 ? (
                      <Dropdown
                        toggle={
                          isSmallScreen() ? (
                            <KebabToggle
                              onToggle={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                            />
                          ) : (
                            <DropdownToggle
                              id="download-steps-logs-toggle"
                              onToggle={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                            >
                              Download
                            </DropdownToggle>
                          )
                        }
                        isOpen={isDownloadDropdownOpen}
                        isPlain={isSmallScreen()}
                        dropdownItems={[
                          <DropdownItem key="current-container-logs" onClick={onDownload}>
                            <Truncate
                              content={
                                isSmallScreen() ? 'Download current step log' : 'Current step log'
                              }
                            />
                          </DropdownItem>,
                          <DropdownItem key="all-container-logs" onClick={onDownloadAll}>
                            <Truncate
                              content={isSmallScreen() ? 'Download all step logs' : 'All step logs'}
                            />
                          </DropdownItem>,
                        ]}
                      />
                    ) : (
                      <Tooltip position="top" content={<div>Download current step log</div>}>
                        <Button
                          onClick={onDownload}
                          variant="link"
                          aria-label="Download current step log"
                          icon={<DownloadIcon />}
                          isDisabled={!canDownload}
                        >
                          Download
                        </Button>
                      </Tooltip>
                    )}
                  </SplitItem>
                  <SplitItem>
                    <Tooltip
                      position="top"
                      content={!isFullScreen ? <div>Expand</div> : <div>Collapse</div>}
                    >
                      <Button
                        onClick={onExpandClick}
                        variant="plain"
                        aria-label="View log viewer in full screen"
                      >
                        {!isFullScreen ? (
                          <>
                            <ExpandIcon />
                          </>
                        ) : (
                          <>
                            <CompressIcon />
                          </>
                        )}
                      </Button>
                    </Tooltip>
                  </SplitItem>
                </Split>
              </ToolbarContent>
            </Toolbar>
          }
          footer={
            isPaused && (
              <Button onClick={() => setIsPaused(false)} isBlock icon={<OutlinedPlayCircleIcon />}>
                Resume refreshing log
              </Button>
            )
          }
          onScroll={onScroll}
        />
      </StackItem>
    </Stack>
  );
};

export default LogsTab;
