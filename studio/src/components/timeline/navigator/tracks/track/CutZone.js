/**
 * Created by valerio bartolini.
 */
import Zone from 'Zones/Zone';
/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/

/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class CutZone extends Zone {
  constructor(config, $parent) {
    super(config, $parent);
    this.render($parent);
  }

  setStart(start) {
    super.setStart(start);
  }

  setDuration(duration) {
    super.setDuration(duration);
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  render() {
    this.$node.classList.add('cut-zone');
  }
}
