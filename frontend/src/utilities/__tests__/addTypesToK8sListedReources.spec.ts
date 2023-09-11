import { addTypesToK8sListedResources } from '~/utilities/addTypesToK8sListedResources';

const servingRuntimeTemplate = {
  apiVersion: 'template.openshift.io/v1',
  items: [
    {
      apiVersion: 'serving.kserve.io/v1alpha1',
      kind: 'ServingRuntime',
      metadata: {
        name: 'test-model',
        annotations: {
          'openshift.io/display-name': 'New OVMS Server',
        },
        labels: {
          'opendatahub.io/dashboard': 'true',
        },
      },
    },
  ],
  metadata: {
    resourceVersion: '24348645',
    continue: '',
  },
};

const templateWithKind = {
  apiVersion: 'v1',
  apiGroup: 'template.openshift.io',
  kind: 'Template',
  plural: 'templates',
};

const templateWithoutKind = {
  apiVersion: 'v1',
  apiGroup: 'template.openshift.io',
  kind: '',
  plural: 'templates',
};

describe('addTypesToK8sListedResources', () => {
  it('should have kind as Template', () => {
    expect(servingRuntimeTemplate.items[0].kind).not.toBe('Template');
    expect(
      addTypesToK8sListedResources(servingRuntimeTemplate, templateWithKind).items[0].kind,
    ).toBe('Template');
  });

  it('should not have kind as Template', () => {
    expect(
      addTypesToK8sListedResources(servingRuntimeTemplate, templateWithoutKind).items[0].kind,
    ).not.toBe('Template');
  });
});
