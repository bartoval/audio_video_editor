import Library from './Library';
import Config from 'Config';

export default class Container {
  constructor($parent) {
    this.$node = $parent;

    this.library = new Library(this.$node, {
      api: { list: Config.getUrl('metaInfoAudioList') }
    });

    this.library.load();
  }
}
