const mockProjectRepo = {
  findAll: vi.fn(),
  findByUuid: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
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
    it('returns all projects', async () => {
      const projects = [
        { uuid: '1', title: 'Project A' },
        { uuid: '2', title: 'Project B' }
      ];
      mockProjectRepo.findAll.mockResolvedValue(projects);

      const result = await service.listProjects();

      expect(result).toEqual(projects);
      expect(mockProjectRepo.findAll).toHaveBeenCalled();
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
    it('creates project with title', async () => {
      const newProject = { uuid: 'new-uuid', title: 'New Project' };
      mockProjectRepo.create.mockResolvedValue(newProject);

      const result = await service.createProject('New Project');

      expect(result).toEqual(newProject);
      expect(mockProjectRepo.create).toHaveBeenCalledWith('New Project');
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
});
