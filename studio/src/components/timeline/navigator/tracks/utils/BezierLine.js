const _C = (startPosX, startPosY, posX, posY, controlX, controlValue) => {
  return (
    'C' +
    startPosX +
    ',' +
    startPosY +
    ',' +
    controlX +
    ',' +
    controlValue +
    ',' +
    posX +
    ',' +
    posY
  );
};

const _L = (posX, posY) => {
  return 'L' + posX + ',' + posY;
};

export default class BezierLine {
  constructor(startX, value) {
    this.startX = startX;
    this.startControlX = startX;
    this.endX = startX;
    this.endControlX = startX;
    this.controlX = startX;
    this.startValue = value;
    this.startControlValue = value;
    this.endValue = value;
    this.endControlValue = value;
    this.controlValue = this.endValue;
  }

  getStartPosX() {
    return parseFloat(this.startX);
  }

  getEndPosX() {
    return parseFloat(this.endX);
  }

  getEndValue() {
    return parseFloat(this.endValue);
  }

  getWidth() {
    return parseFloat(this.endX - this.startX);
  }

  saveStartPoint(posX, value) {
    this.startX = posX;
    this.startControlX = posX;
    this.startValue = value;
    this.startControlValue = value;
  }

  saveControlPoint(posX, posY) {
    let newPosX = posX < this.startX ? this.startX : posX;
    newPosX = posX > this.endX ? this.endX : newPosX;
    this.startControlX = newPosX;
    this.startControlValue = posY;

    this.drawLine();
  }

  saveEndPoint(posX, value = this.endValue) {
    const finalX = posX - this.startX < 1 ? this.startX + 1 : posX;

    this.endX = finalX;
    this.endControlX = finalX;
    this.endValue = value;
    this.endControlValue = value;
    this.controlX = finalX;
    this.controlValue = value;
  }

  drawLine() {
    return (
      _L(this.startX, this.startValue) +
      ',' +
      _C(
        this.startControlX,
        this.startControlValue,
        this.endControlX,
        this.endControlValue,
        this.controlX,
        this.controlValue
      ) +
      ',' +
      _L(this.endX, this.endValue) +
      ','
    );
  }

  /** Scale all X coordinates by a factor */
  scaleX(factor) {
    this.startX *= factor;
    this.startControlX *= factor;
    this.endX *= factor;
    this.endControlX *= factor;
    this.controlX *= factor;
  }
}
