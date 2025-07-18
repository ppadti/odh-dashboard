import * as _ from 'lodash-es';
import {
  k8sCreateResource,
  k8sDeleteResource,
  k8sGetResource,
  k8sListResource,
  k8sPatchResource,
  K8sStatus,
  k8sUpdateResource,
} from '@openshift/dynamic-plugin-sdk-utils';
import { HardwareProfileKind, K8sAPIOptions } from '#~/k8sTypes';
import { HardwareProfileModel } from '#~/api/models';
import { applyK8sAPIOptions } from '#~/api/apiMergeUtils';
import { kindApiVersion, translateDisplayNameForK8s } from '#~/concepts/k8s/utils';
import { DisplayNameAnnotation } from '#~/types.ts';

export const listHardwareProfiles = async (namespace: string): Promise<HardwareProfileKind[]> =>
  k8sListResource<HardwareProfileKind>({
    model: HardwareProfileModel,
    queryOptions: {
      ns: namespace,
    },
  }).then((listResource) => listResource.items);

export const getHardwareProfile = (name: string, namespace: string): Promise<HardwareProfileKind> =>
  k8sGetResource<HardwareProfileKind>({
    model: HardwareProfileModel,
    queryOptions: { name, ns: namespace },
  });

export const assembleHardwareProfile = (
  hardwareProfileName: string,
  data: HardwareProfileKind['spec'] & {
    displayName: string;
    enabled: boolean;
    description?: string;
  },
  namespace: string,
  visibility: string[] = [],
): HardwareProfileKind => {
  const { displayName, enabled, description, ...spec } = data;
  return {
    apiVersion: kindApiVersion(HardwareProfileModel),
    kind: HardwareProfileModel.kind,
    metadata: {
      name: hardwareProfileName || translateDisplayNameForK8s(displayName),
      namespace,
      annotations: {
        [DisplayNameAnnotation.ODH_DISP_NAME]: displayName,
        ...(description && { [DisplayNameAnnotation.ODH_DESC]: description }),
        'opendatahub.io/disabled': (!enabled).toString(),
        'opendatahub.io/modified-date': new Date().toISOString(),
        'opendatahub.io/dashboard-feature-visibility': JSON.stringify(visibility),
      },
    },
    spec,
  };
};

export const createHardwareProfile = (
  hardwareProfileName: string,
  data: HardwareProfileKind['spec'] & {
    displayName: string;
    enabled: boolean;
    description?: string;
  },
  namespace: string,
  visibility?: string[],
  opts?: K8sAPIOptions,
): Promise<HardwareProfileKind> => {
  const resource = assembleHardwareProfile(hardwareProfileName, data, namespace, visibility);
  return k8sCreateResource<HardwareProfileKind>(
    applyK8sAPIOptions(
      {
        model: HardwareProfileModel,
        resource,
      },
      opts,
    ),
  );
};

export const createHardwareProfileFromResource = (
  resource: HardwareProfileKind,
  opts?: K8sAPIOptions,
): Promise<HardwareProfileKind> =>
  k8sCreateResource<HardwareProfileKind>(
    applyK8sAPIOptions(
      {
        model: HardwareProfileModel,
        resource,
      },
      opts,
    ),
  );

export const updateHardwareProfile = (
  data: HardwareProfileKind['spec'] & {
    displayName: string;
    enabled: boolean;
    description?: string;
  },
  existingHardwareProfile: HardwareProfileKind,
  namespace: string,
  visibility?: string[],
  opts?: K8sAPIOptions,
): Promise<HardwareProfileKind> => {
  const resource = assembleHardwareProfile(
    existingHardwareProfile.metadata.name,
    data,
    namespace,
    visibility,
  );

  const oldHardwareProfile = structuredClone(existingHardwareProfile);
  // clean up the resources from the old hardware profile
  oldHardwareProfile.spec.identifiers = [];
  const oldHardwareProfileScheduling = oldHardwareProfile.spec.scheduling;
  if (resource.spec.scheduling?.kueue && oldHardwareProfileScheduling?.node) {
    delete oldHardwareProfileScheduling.node;
  } else if (oldHardwareProfileScheduling?.node) {
    oldHardwareProfileScheduling.node.nodeSelector = {};
    oldHardwareProfileScheduling.node.tolerations = [];
  }
  if (resource.spec.scheduling?.node && oldHardwareProfileScheduling?.kueue) {
    delete oldHardwareProfileScheduling.kueue;
  }

  const hardwareProfileResource = _.merge({}, oldHardwareProfile, resource);

  return k8sUpdateResource<HardwareProfileKind>(
    applyK8sAPIOptions({ model: HardwareProfileModel, resource: hardwareProfileResource }, opts),
  );
};

export const toggleHardwareProfileEnablement = (
  name: string,
  namespace: string,
  enabled: boolean,
  opts?: K8sAPIOptions,
): Promise<HardwareProfileKind> =>
  k8sPatchResource<HardwareProfileKind>(
    applyK8sAPIOptions(
      {
        model: HardwareProfileModel,
        queryOptions: { name, ns: namespace },
        patches: [
          {
            op: 'replace',
            path: '/metadata/annotations/opendatahub.io~1disabled',
            value: (!enabled).toString(),
          },
        ],
      },
      opts,
    ),
  );

export const deleteHardwareProfile = (
  hardwareProfileName: string,
  namespace: string,
  opts?: K8sAPIOptions,
): Promise<K8sStatus> =>
  k8sDeleteResource<HardwareProfileKind, K8sStatus>(
    applyK8sAPIOptions(
      {
        model: HardwareProfileModel,
        queryOptions: { name: hardwareProfileName, ns: namespace },
      },
      opts,
    ),
  );
