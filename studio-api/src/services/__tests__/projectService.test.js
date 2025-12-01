const mockProjectRepo = {
  findAll: vi.fn(),
  findByUser: vi.fn(),
  findByUuid: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  share: vi.fn(),
  unshare: vi.fn(),
  hasAccess: vi.fn(),
  getCoverPath: vi.fn()
};

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

const { projectServiceCreator } = require('../projectService');

describe('projectService', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = projectServiceCreator({ projectRepo: mockProjectRepo });
  });

  describe('listProjects', () => {
    it('returns all projects when no userId', async () => {
      const projects = [
        { uuid: '1', title: 'Project A' },
        { uuid: '2', title: 'Project B' }
      ];
      mockProjectRepo.findAll.mockResolvedValue(projects);

      const result = await service.listProjects();

      expect(result).toEqual(projects);
      expect(mockProjectRepo.findAll).toHaveBeenCalled();
    });

    it('filters by user when userId provided', async () => {
      const userProjects = [{ uuid: '1', title: 'My Project' }];
      mockProjectRepo.findByUser.mockResolvedValue(userProjects);

      const result = await service.listProjects('user-123');

      expect(result).toEqual(userProjects);
      expect(mockProjectRepo.findByUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getProject', () => {
    it('returns project when found', async () => {
      const project = { uuid: 'abc', title: 'Test' };
      mockProjectRepo.findByUuid.mockResolvedValue(project);

      const result = await service.getProject('abc');

      expect(result).toEqual(project);
    });

    it('throws NotFoundError when not found', async () => {
      mockProjectRepo.findByUuid.mockResolvedValue(null);

      await expect(service.getProject('missing')).rejects.toThrow('Project not found: missing');
    });
  });

  describe('createProject', () => {
    it('creates project with title and owner', async () => {
      const newProject = { uuid: 'new-uuid', title: 'New Project', ownerId: 'user-1' };
      mockProjectRepo.create.mockResolvedValue(newProject);

      const result = await service.createProject('New Project', 'user-1');

      expect(result).toEqual(newProject);
      expect(mockProjectRepo.create).toHaveBeenCalledWith('New Project', null, 'user-1');
    });

    it('creates project without owner', async () => {
      mockProjectRepo.create.mockResolvedValue({ uuid: 'x', title: 'Test' });

      await service.createProject('Test');

      expect(mockProjectRepo.create).toHaveBeenCalledWith('Test', null, null);
    });
  });

  describe('deleteProject', () => {
    it('deletes existing project', async () => {
      mockProjectRepo.remove.mockResolvedValue(true);

      const result = await service.deleteProject('abc');

      expect(result).toEqual({ success: true });
      expect(mockProjectRepo.remove).toHaveBeenCalledWith('abc');
    });

    it('throws NotFoundError when project does not exist', async () => {
      mockProjectRepo.remove.mockResolvedValue(false);

      await expect(service.deleteProject('missing')).rejects.toThrow('Project not found: missing');
    });
  });

  describe('shareProject', () => {
    it('shares project with user and permission', async () => {
      mockProjectRepo.share.mockResolvedValue({
        uuid: 'abc',
        sharedWith: [{ userId: 'u2', permission: 'edit' }]
      });

      const result = await service.shareProject('abc', 'u2', 'edit');

      expect(mockProjectRepo.share).toHaveBeenCalledWith('abc', 'u2', 'edit');
      expect(result.sharedWith).toHaveLength(1);
    });
  });

  describe('unshareProject', () => {
    it('removes sharing for user', async () => {
      mockProjectRepo.unshare.mockResolvedValue(true);

      const result = await service.unshareProject('abc', 'u2');

      expect(result).toBe(true);
      expect(mockProjectRepo.unshare).toHaveBeenCalledWith('abc', 'u2');
    });
  });

  describe('hasAccess', () => {
    it('delegates to repository', async () => {
      mockProjectRepo.hasAccess.mockResolvedValue(true);

      const result = await service.hasAccess('abc', 'user-1', 'edit');

      expect(result).toBe(true);
      expect(mockProjectRepo.hasAccess).toHaveBeenCalledWith('abc', 'user-1', 'edit');
    });
  });
});
