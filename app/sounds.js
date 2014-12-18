module.exports = Sounds;

function Sounds() {
  this.ambientTrack = new Howl({
    urls: ['assets/audio/ambient-loop.ogg','assets/audio/ambient-loop.mp3','assets/audio/ambient-loop.m4a'],
    autoplay: true,
    loop: true
  });

  this.songTrack = new Howl({
    urls: ['assets/audio/white-christmas.ogg','assets/audio/white-christmas.mp3','assets/audio/white-christmas.m4a'],
    autoplay: true,
    loop: false
  });


}

Sounds.prototype.init = function(){
  this.ambientTrack.volume(0.3);
  this.songTrack.volume(0.4);
}