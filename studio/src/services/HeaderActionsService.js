/**
 * HeaderActionsService - Persistence and exports for header actions
 *
 * Handles workspace persistence and export:
 * - load: read workspace data on this device
 * - save: persist current state on this device
 * - sync: explicitly transfer projects and media to/from the server
 * - preview: export and generate preview video
 */
import { EVENT } from '../config/constants';
import * as api from './api';
import SyncManager from './offline/SyncManager';
import * as EventService from './EventService';

class HeaderActionsService {
  async load() {
    try {
      const response = await api.load();
      const isEmpty = Object.keys(response).length === 0;

      if (isEmpty) {
        return { success: true, data: null };
      }

      if (response.video) {
        await EventService.emitAsync(EVENT.WORKSPACE_LOAD_VIDEO, {
          url: response.video,
          config: response
        });
      } else {
        const maxAudioEnd = (response.tracks || []).reduce((max, track) => {
          const endTime = (track.startTime || 0) + (track.durationTime || 0);

          return Math.max(max, endTime);
        }, 0);

        await EventService.emitAsync(EVENT.WORKSPACE_INIT_AUDIO_ONLY, {
          ...response,
          maxAudioEnd
        });
      }

      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async save() {
    try {
      const data = await EventService.emitAsync(EVENT.WORKSPACE_GET_DATA);
      return await api.backup(data);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async sync() {
    const saved = await this.save();
    if (!saved.success) return saved;
    try {
      await SyncManager.sync();
      EventService.connect();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async preview({ format } = {}) {
    try {
      const data = await EventService.emitAsync(EVENT.WORKSPACE_GET_DATA);

      if (format) {
        data.format = format;
      }

      const response = await api.publish(data);

      return {
        success: true,
        url: response.res,
        type: response.type || 'video'
      };
    } catch (error) {
      console.error('[HeaderActionsService] Export error:', error);

      return { success: false, error: String(error) };
    }
  }
}

export default new HeaderActionsService();
