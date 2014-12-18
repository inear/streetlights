var detector = require('./utils/detector');

module.exports = PostEffectManager;

function PostEffectManager( scene, reflectiveScene, camera, renderer ){
  this.renderer = renderer;
  this.scene = scene;
  this.reflectiveScene = reflectiveScene;
  this.camera = camera;

  this.sizeRatio = 1;

  this.init();
  this.resize({width:window.innerWidth,height:window.innerHeight});
}


var p = PostEffectManager.prototype;

p.init = function(){


  this.bluriness = 2;

  var renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
  this.reflectRenderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, renderTargetParameters );

  this.reflectComposer = new THREE.EffectComposer( this.renderer, this.reflectRenderTarget);

  this.reflectRenderPass = new THREE.RenderPass( this.reflectiveScene, this.camera,null, new THREE.Color(0x111122),1 );
  this.reflectComposer.addPass( this.reflectRenderPass );
  this.hblur = new THREE.ShaderPass( THREE.HorizontalBlurShader );
  this.reflectComposer.addPass( this.hblur );
  this.vblur = new THREE.ShaderPass( THREE.VerticalBlurShader );
  //this.vblur.renderToScreen = true;
  this.reflectComposer.addPass( this.vblur );



  renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
  this.finalRenderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, renderTargetParameters );
  this.finalComposer = new THREE.EffectComposer( this.renderer, this.finalRenderTarget );
  this.finalRenderPass = new THREE.RenderPass( this.scene, this.camera,null, new THREE.Color(0xff1122),0,true);
  this.finalRenderPass.clear = false;
  this.finalRenderPass.clearDepth = true;
  this.bloom = new THREE.BloomPass(0.95);

  this.texturePass = new THREE.TexturePass( this.reflectRenderTarget );


  var effectVignette = new THREE.ShaderPass( THREE.VignetteShader );
  effectVignette.uniforms[ "offset" ].value = 1.0;
  effectVignette.uniforms[ "darkness" ].value = 1.1;
  effectVignette.renderToScreen = true;

  //this.finalComposer.addPass( this.reflectRenderPass );
  this.finalComposer.addPass( this.texturePass );

  this.finalComposer.addPass( this.finalRenderPass );

  if(!detector.isMobile && !detector.isTablet){
    this.finalComposer.addPass( this.bloom );
  }

  this.finalComposer.addPass( effectVignette );
};

p.renderAbove = function(){

  this.renderer.clear(false,true,false);
  this.finalComposer.render();

};


p.renderReflect = function(){
  this.renderer.clear(false,true,false);
  this.reflectComposer.render();

};

p.resize = function( data ){

  var w = data.width;
  var h = data.height;

  this.size = data;
  this.sizeRatio = data.sizeRatio || this.sizeRatio;


  if( this.reflectComposer ) {

    this.hblur.uniforms[ 'h' ].value = this.bluriness / ( data.width/this.sizeRatio );
    this.vblur.uniforms[ 'v' ].value = this.bluriness / ( data.height/this.sizeRatio );

    //this.fxaa.uniforms[ 'resolution' ].value = new THREE.Vector2( 1/(w/this.sizeRatio)/window.devicePixelRatio, 1/(h/this.sizeRatio)/window.devicePixelRatio  );
    this.reflectComposer.reset();
    console.log(this.sizeRatio)

    this.reflectComposer.setSize(w/this.sizeRatio, h/this.sizeRatio);

    this.texturePass.uniforms[ "tDiffuse" ].value = this.reflectComposer.renderTarget2;

  }

  if( this.finalComposer ) {

    this.finalComposer.reset();

    this.finalComposer.setSize(w/this.sizeRatio, h/this.sizeRatio);

  }

};

p.destroy = function(){
  this.renderer = undefined;
  this.scene = undefined;
  this.camera = undefined;

  this.reflectRenderPass.destroy();

  THREE.EffectComposer.scene.remove( THREE.EffectComposer.quad );

  THREE.EffectComposer.camera = undefined;
  THREE.EffectComposer.quad = undefined;
  THREE.EffectComposer.scene = undefined;

};
