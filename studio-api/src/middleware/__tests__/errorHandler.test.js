vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

vi.mock('../../config', () => ({
  env: 'development'
}));

const { NotFoundError, ValidationError, ConflictError } = require('../../utils/errors');
const { errorHandler, notFoundHandler } = require('../errorHandler');

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headersSent: false,
    status(code) {
      res.statusCode = code;

      return res;
    },
    json(data) {
      res.body = data;

      return res;
    }
  };

  return res;
}

function mockReq(overrides = {}) {
  return { path: '/test', method: 'GET', ...overrides };
}

describe('errorHandler', () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AppError subclasses', () => {
    it('returns 404 for NotFoundError', () => {
      const req = mockReq();
      const res = mockRes();
      const err = new NotFoundError('Project not found');

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      });
    });

    it('returns 400 for ValidationError', () => {
      const req = mockReq();
      const res = mockRes();
      const err = new ValidationError('Invalid ratio');

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid ratio' }
      });
    });

    it('returns 409 for ConflictError', () => {
      const req = mockReq();
      const res = mockRes();
      const err = new ConflictError('Already exists');

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(409);
      expect(res.body).toEqual({
        error: { code: 'CONFLICT', message: 'Already exists' }
      });
    });
  });

  describe('Multer errors', () => {
    it('returns 413 for LIMIT_FILE_SIZE', () => {
      const req = mockReq();
      const res = mockRes();
      const err = new Error('File too large');
      err.code = 'LIMIT_FILE_SIZE';

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('returns 400 for INVALID_FILE_TYPE', () => {
      const req = mockReq();
      const res = mockRes();
      const err = new Error('Bad file type');
      err.code = 'INVALID_FILE_TYPE';

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    });
  });

  describe('Unknown errors', () => {
    it('returns 500 with error message in dev mode', () => {
      const req = mockReq();
      const res = mockRes();
      const err = new Error('Something broke');

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).toBe('Something broke');
    });

    it('hides error message in production', () => {
      const config = require('../../config');
      const originalEnv = config.env;
      config.env = 'production';

      const req = mockReq();
      const res = mockRes();
      const err = new Error('Secret DB error');

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(500);
      expect(res.body.error.message).toBe('Internal server error');

      config.env = originalEnv;
    });
  });

  describe('headers already sent', () => {
    it('delegates to next() when headers already sent', () => {
      const req = mockReq();
      const res = mockRes();
      res.headersSent = true;
      const err = new Error('Stream error');

      errorHandler(err, req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.statusCode).toBeNull();
    });
  });

  describe('response format consistency', () => {
    it('always wraps errors in { error: { code, message } }', () => {
      const cases = [new NotFoundError(), new ValidationError(), new Error('generic')];

      for (const err of cases) {
        const res = mockRes();
        errorHandler(err, mockReq(), res, next);

        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
      }
    });
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with route info', () => {
    const req = mockReq({ method: 'POST', path: '/api/v1/missing' });
    const res = mockRes();

    notFoundHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('POST');
    expect(res.body.error.message).toContain('/api/v1/missing');
  });
});
