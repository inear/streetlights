module.exports = LightSequence;

function LightSequence( sets ){

  this.sets = sets;

  this.lightsPerCable = sets[0].bulbs.length;

  this.isRunning = false;
  this.lastUpdateTime = 0;
  this.modeIndex = -1;
  this.currentMode = null;
  this.modes = [
    {
      interval:0.5,
      setModulus:2,
      modulus:1
    },
    {
      interval:0.1,
      setModulus:1,
      modulus:2
    },
    {
      interval:1,
      setModulus:1,
      modulus:2
    },
    {
      interval:0.3,
      setModulus:1,
      modulus:3
    }

  ];

  this.sequenceStep = 0;
}


var p = LightSequence.prototype;

p.start = function(){
  this.isRunning = true;
  this.modeIndex = -1;
  this.nextMode();
};

p.nextMode = function(){
  this.modeIndex++;

  if( this.modeIndex > this.modes.length -1) {
    this.modeIndex = 0;
  }

  this.currentMode = this.modes[this.modeIndex];

  TweenMax.delayedCall(4,this.nextMode,null,this);

};

p.update = function(time){

  if( !this.isRunning ) {
    return;
  }

  var self = this;
  var innerBulb,mirrorBulb;
  var i,j;

  var delta = time - this.lastUpdateTime;

  if( delta > this.currentMode.interval ) {

    this.sequenceStep++;

    //iterate every light
    for (i = this.sets.length - 1; i >= 0; i--) {
      set = this.sets[i];

      for (j = this.lightsPerCable - 1; j >= 0; j--) {

        if( this.sets[i].bulbs[j].innerBulb ) {
          innerBulb = this.sets[i].bulbs[j].innerBulb;
          mirrorBulb = this.sets[i].mirrorBulbs[j];

          if( (j+this.sequenceStep)%this.currentMode.modulus || (i+this.sequenceStep)%this.currentMode.setModulus) {
            innerBulb.visible = false;
            mirrorBulb.visible = false;
          }
          else {
            innerBulb.visible = true;
            mirrorBulb.visible = true;
          }
        }
      }
    }

    this.lastUpdateTime = time;
  }


};