export default class ChunkedUploader {
  constructor(url, options = {}) {
    this.url = url;
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB default
    this.maxRetries = options.maxRetries || 3;
    this.parallelUploads = options.parallelUploads || 3;
    this.aborted = false;
  }

  /**
   * Generate unique identifier for file
   * Includes timestamp to ensure uniqueness even when re-uploading same file
   */
  _generateIdentifier(file) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    return `${file.size}-${file.name.replace(/\W/g, '')}-${timestamp}-${random}`;
  }

  /**
   * Upload a single chunk with retry logic
   * Returns the server response JSON
   */
  async _uploadChunk(file, chunkIndex, totalChunks, identifier, projectUuid) {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk, file.name);
    formData.append('flowChunkNumber', chunkIndex + 1);
    formData.append('flowTotalChunks', totalChunks);
    formData.append('flowChunkSize', this.chunkSize);
    formData.append('flowCurrentChunkSize', chunk.size);
    formData.append('flowTotalSize', file.size);
    formData.append('flowIdentifier', identifier);
    formData.append('flowFilename', file.name);
    formData.append('flowRelativePath', file.name);
    formData.append('project_uuid', projectUuid);

    let retries = 0;

    while (retries < this.maxRetries) {
      if (this.aborted) {
        throw new Error('Upload aborted');
      }

      try {
        const response = await fetch(this.url, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const data = await response.json();

          return data;
        }

        throw new Error(`HTTP ${response.status}`);
      } catch (err) {
        retries++;

        if (retries >= this.maxRetries) {
          throw err;
        }

        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * retries));
      }
    }
  }

  /**
   * Upload file with parallel chunk uploads
   * Waits for server to signal file assembly is complete
   */
  async upload(file, projectUuid, callbacks = {}) {
    const { onProgress, onComplete, onError } = callbacks;
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const identifier = this._generateIdentifier(file);

    this.aborted = false;
    let completedChunks = 0;
    let isComplete = false;

    // Create array of chunk indices
    const chunks = Array.from({ length: totalChunks }, (_, i) => i);

    // Process chunks in parallel batches
    const uploadBatch = async batch => {
      const results = await Promise.all(
        batch.map(async chunkIndex => {
          const result = await this._uploadChunk(
            file,
            chunkIndex,
            totalChunks,
            identifier,
            projectUuid
          );
          completedChunks++;
          onProgress?.(Math.round((completedChunks / totalChunks) * 100));

          return result;
        })
      );

      // Check if any response indicates completion
      for (const result of results) {
        if (result && result.status === 'complete') {
          isComplete = true;
        }
      }
    };

    try {
      // Process in batches of parallelUploads
      for (let i = 0; i < chunks.length; i += this.parallelUploads) {
        if (this.aborted) {
          throw new Error('Upload aborted');
        }

        const batch = chunks.slice(i, i + this.parallelUploads);
        await uploadBatch(batch);
      }

      // Only call onComplete when server confirms file assembly
      if (isComplete) {
        onComplete?.();
      }

      return true;
    } catch (err) {
      onError?.(err);

      throw err;
    }
  }

  /**
   * Abort current upload
   */
  abort() {
    this.aborted = true;
  }
}
