const mockFileRepo = {
  readJson: vi.fn(),
  writeJson: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined)
};

const { projectRepositoryCreator } = require('../projectRepository');

describe('projectRepository', () => {
  let repository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileRepo.readJson.mockResolvedValue(null);
    repository = projectRepositoryCreator({ fileRepo: mockFileRepo });
  });

  it('reads legacy projects without exposing obsolete metadata or rewriting the registry', async () => {
    const project = { uuid: 'existing-uuid', title: 'Existing Project', isVideoLoaded: true };
    mockFileRepo.readJson.mockResolvedValue({
      projects: [{ ...project, ownerId: 'former-user', sharedWith: [], isPublic: false }]
    });

    const projects = await repository.findAll();

    expect(projects).toEqual([project]);
    expect(mockFileRepo.writeJson).not.toHaveBeenCalled();
  });

  it('creates a project with a custom UUID and the current metadata schema', async () => {
    const project = { uuid: '0', title: 'Default', isVideoLoaded: false };

    const result = await repository.create('Default', '0');

    expect(result).toEqual(project);
    expect(mockFileRepo.writeJson).toHaveBeenCalledWith(expect.any(String), {
      projects: [project]
    });
  });
});
