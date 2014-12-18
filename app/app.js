(function () {
   'use strict';
   // this function is strict...
}());

module.exports = App;

var DomEventMap = require('dom-event-map');
var raf = require('raf');
var mixin = require('mixin');
var debug = require('debug');
var forEach = require('for-each');
var settings = require('./settings');
var SettingsUI = require('./settings-ui');
var detector = require('./utils/detector');
var ObjectPool = require('./utils/object-pool');
var PostEffectManager = require('./post-effect-manager');
var ParticleEngine = require('./particle-engine');
var modelGeometries = require('./geometries/package.js');
var LightSequence = require('./light-sequence.js');
var loader = new THREE.JSONLoader( true );
var Sounds = require('./sounds');

//var Sounds = require('./sounds');

var SHADOW_MAP_WIDTH = 1024*2;
var SHADOW_MAP_HEIGHT = 1024*2;
var LAMPS_PER_CABLE = 32;

Math.easeInOutQuad = function (t, b, c, d) {
  t /= d/2;
  if (t < 1) return c/2*t*t + b;
  t--;
  return -c/2 * (t*(t-2) - 1) + b;
};

function App() {

  this.usePostProcessing = true;//!detector.isMobile && !detector.isTablet;

  this.panning = false;
  this.downTime = 0;
  this._mouse2DStart = new THREE.Vector2();
  this.touchStartPoint = new THREE.Vector2();
  this.touchPoint1 = new THREE.Vector2();
  this.groundSize = {width:2000,height:2000};
  this.sets = [];
  this.springs = [];
  this.size = {};
  this._cursor = '';
  this._mouse2D = new THREE.Vector2(window.innerWidth*0.5, window.innerHeight*0.5);
  this._normalizedMouse2D = new THREE.Vector2();

  this.lightsOn = false;

  this._cameraOffset = new THREE.Vector3(0,20,140);

  this.totalSets = detector.isMobile?5:10;

  //bind scope

  this._draw = this._draw.bind(this);
  this._onResize = this._onResize.bind(this);
  this._onMouseMove = this._onMouseMove.bind(this);
  this._onMouseDown = this._onMouseDown.bind(this);
  this._onMouseUp = this._onMouseUp.bind(this);
  this._onTouchStart = this._onTouchStart.bind(this);
  this._onTouchEnd = this._onTouchEnd.bind(this);
  this._onTouchMove = this._onTouchMove.bind(this);
  this._updateMousePicker = this._updateMousePicker.bind(this);

  this.sizeRatio = 1;


  this._lookAtPosition = null;

  //this.settingsUI = new SettingsUI();

}

DomEventMap(App.prototype);

mixin(App.prototype, {

  init: function() {

    /*if( detector.isMobile ) {
      this._showFallback();
      return;
    }
*/
    //this._sounds = new Sounds();
    //this._sounds.init();

    this._stage = document.getElementById('stage');
    this._$stage = $(document.getElementById('stage'));

    this._clock = new THREE.Clock();

    var success = this._init3D();

    if( !success ) {
      this._showFallback();
      return;
    }

    this._sounds = new Sounds();
    this._sounds.init();

    this._initLights();
    this._createSceneObjects();
    this._setupPhysics();
    this.lightSequence = new LightSequence(this.sets);

    if( this.usePostProcessing ) {
      this.postEffectManager = new PostEffectManager(this.scene,this.reflectiveScene,this.camera,this.renderer);
    }

    this._onResize();

    this._draw();

    this._addEventListeners();

    this._switchLights(false);
    TweenMax.delayedCall(2,this._switchLights,[true],this);

  },


  _addEventListeners: function(){

    var self = this;

    this.mapListener(window, 'resize', this._onResize);
    this.mapListener(window, 'mouseup', this._onMouseUp);
    this.mapListener(this._stage, 'mousedown', this._onMouseDown);
    this.mapListener(this._stage, 'mousemove', this._onMouseMove);

    this.mapListener(this._stage,'touchmove', this._onTouchMove);
    this.mapListener(this._stage,'touchstart', this._onTouchStart);


  },

  _onTouchStart:  function( event ){
    event.preventDefault();
    this.downTime = Date.now();

    this._mouse2DStart.copy(this._mouse2D);
    this.touchStartPoint.set(event.touches[0].clientX, event.touches[0].clientY);

    if( event.touches.length === 1  ) {
    }
    else {
      this.panning = true;
    }

    document.addEventListener('touchend', this._onTouchEnd);

  },

  _onTouchEnd: function( event ){

    event.preventDefault();

    if( event.touches.length === 0 ) {

      if( this.panning ) {
        this.panning = false;
      }
      else {
        if( Date.now() - this.downTime < 300 ) {

          this._updateMousePicker((this.touchStartPoint.x/this.size.width-0.5)*2,(this.touchStartPoint.y/this.size.height-0.5)*2);
          //this._updateMousePicker(this.touchStartPoint.x,this.touchStartPoint.y);
        }
      }

      document.removeEventListener('touchend', this._onTouchEnd);

    }

  },

  _onTouchMove: function( event ){

    this._mouse2D.set( this._mouse2DStart.x - (event.touches[0].clientX-this.touchStartPoint.x) ,this._mouse2DStart.y - ((event.touches[0].clientY)-this.touchStartPoint.y));
    this._onMove();
  },

  _onMouseMove: function( evt ){
    this._mouse2D.set(evt.clientX,evt.clientY);
    this._onMove();
  },

  _onMove: function(){

    this._normalizedMouse2D.set(
      (this._mouse2D.x/this.size.width-0.5)*2,
      (this._mouse2D.y/this.size.height-0.5)*2
    );

    if( this._mouseIsDown ) {
      return;
    }

    var vector = new THREE.Vector3(this._normalizedMouse2D.x,this._normalizedMouse2D.y*-1,0.5);
    vector.unproject(this.camera);

    var raycaster = new THREE.Raycaster(this.camera.position,vector.sub(this.camera.position).normalize() );
    var intersects = raycaster.intersectObjects( this._collisionList );

    this._$stage.removeClass('cursor-attach-left cursor-attach-right cursor-pointer');

    if ( intersects.length > 0 ) {

      var name = intersects[0].object.name;

      if( name.indexOf('b1') !== -1 ) {
        this._$stage.addClass('cursor-attach-left');
      }
      else if( name.indexOf('b2') !== -1 ) {
        this._$stage.addClass('cursor-attach-right');
      }
      else if( name === 'moon' || name === 'sign') {
       this._$stage.addClass('cursor-pointer');
      }
    }

    this._mouseMoved = true;
  },

  _onMouseDown: function( evt ){
    this._mouseIsDown = true;
    this._updateMousePicker();

  },

  _onMouseUp: function( evt ){
    this._mouseIsDown = false;
  },

  _init3D: function(){

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 4000 );
    this.scene = new THREE.Scene();
    this.reflectiveScene = new THREE.Scene();
    this.camera.position.copy( this._cameraOffset );

    if( detector.isTouchDevice && detector.isMobile ) {
      this.sizeRatio = 1;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({canvas: document.getElementById('mainCanvas'),antialias:false,alpha:false});
    }
    catch( err ) {
      return false;
    }

    this.renderer.autoClear = false;
    this.renderer.autoClearDepth = false;
    this.renderer.sortElements = false;
    this.renderer.setClearColor(0x111122,0);

    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    this.renderer.physicallyBasedShading = true;

    this.scene.fog = new THREE.Fog( 0x111122, 0, 1000 );

    if (this.sizeRatio > 1) {
      this.renderer.domElement.style.webkitTransform = "scale3d("+this.sizeRatio+", "+this.sizeRatio+", 1)";
      this.renderer.domElement.style.webkitTransformOrigin = "0 0 0";
    }

    var tex = THREE.ImageUtils.loadTexture('assets/images/branch5.png');
    tex.repeat.x = 10;
    tex.repeat.y = 0.5;
    tex.offset.x = 0.3;
    tex.offset.y = 0.6;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.cableMaterial = new THREE.MeshLambertMaterial({color:0x222222,map:tex,transparent:true,side:THREE.DoubleSide});

    tex = THREE.ImageUtils.loadTexture('assets/images/branch5.png');
    tex.repeat.x = 20;
    tex.repeat.y = 0.5;
    tex.offset.x = 0.3;
    tex.offset.y = 0.1;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.cableMaterial2 = new THREE.MeshLambertMaterial({color:0x252525,map:tex,transparent:true,side:THREE.DoubleSide});

    this.bulbColor = 0xf4ff76;

    var groundNormalTexture = THREE.ImageUtils.loadTexture('assets/images/snow2.jpg');
    groundNormalTexture.repeat.x = 4;
    groundNormalTexture.repeat.y = 4;
    groundNormalTexture.wrapS = groundNormalTexture.wrapT = THREE.RepeatWrapping;

    var groundTexture = THREE.ImageUtils.loadTexture('assets/images/snow.jpg');
    groundTexture.repeat.x = 2;
    groundTexture.repeat.y = 3;
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;

    var moonTexture = THREE.ImageUtils.loadTexture('assets/images/moon2.jpg');

    if( detector.isMobile ) {
      this.groundMaterial = new THREE.MeshPhongMaterial({color:0x333399, map:groundTexture, shininess:20, transparent:true,opacity:0.4});
    }
    else {
      this.groundMaterial = new THREE.MeshPhongMaterial({color:0x333399, map:groundTexture,normalMap:groundNormalTexture, normalScale: new THREE.Vector2(0.1,0.25),shininess:90, transparent:true,opacity:0.4});
    }

    this.bulbMaterial = new THREE.MeshLambertMaterial({color:0xffffff,opacity:0.1,transparent:true});
    this.innerBulbMaterial = new THREE.MeshLambertMaterial({color:this.bulbColor,emissive:this.bulbColor});
    this.bulbMirrorMaterial = new THREE.MeshLambertMaterial({color:this.bulbColor,emissive:this.bulbColor});
    this.starMaterial = new THREE.MeshPhongMaterial({color:0x565a2b,emissive:this.bulbColor});

    var snowTexture = THREE.ImageUtils.loadTexture('assets/images/snow2.jpg');
    snowTexture.repeat.x = 20;
    snowTexture.repeat.y = 10;
    snowTexture.wrapS = snowTexture.wrapT = THREE.RepeatWrapping;

    this.sidewalkMaterial = new THREE.MeshPhongMaterial({color:0x222244,specular:0x333333,shininess:30});

    this.sidewalkMirrorMaterial = new THREE.MeshLambertMaterial( { color:0xffffff, emissive:0x222222 } );


    this.moonMaterial = new THREE.MeshPhongMaterial({color:0xffffff, ambient:0xffffff,map:moonTexture,fog:false,opacity:0.8,transparent:true});

    this.bulbGeometry = new THREE.SphereGeometry(0.6,7,7);
    this.innerBulbGeometry = new THREE.SphereGeometry(0.3,7,7);
    this.starGeometry = loader.parse( JSON.parse(modelGeometries.star) ).geometry;

    this.aboveContainer = new THREE.Object3D();

    this.scene.add(this.aboveContainer);

    this.particleEngine = new ParticleEngine(this.aboveContainer);

    return true;

  },

  _showFallback: function() {

    $('#errorWrapper').removeClass('inactive');

    var el = document.getElementById('errorWrapper');
    el.style.background = "url('../assets/images/fallback-bg.jpg')";
    el.style.backgroundSize = 'cover';

  },


  _initLights: function(){

    var hemiLight = new THREE.HemisphereLight( 0x777780,0x222222 , 1,1 );
    this.scene.add(hemiLight);

  },


  _switchLights: function( status ){

    this.lightsOn = status;

    if( this.lightsOn ){
      this.lightSequence.start();

      this.starMaterial.emissive.set(this.bulbColor);
      this.starMaterial.color.set(0x565a2b);

    }
    else {
      this.starMaterial.emissive.set(0x000000);
    }

    var len = this.sets.length;
    for (var i = 0; i < len; i++) {

      set = this.sets[i];
      set.light.visible = status;
      set.mirrorStar.visible = status;

      TweenMax.to(set.startNode.position, 7, { delay:i*0.8 + Math.random()*2,y:status?70-Math.random()*10*i/10:10, ease:Back.easeInOut});
      TweenMax.to(set.endNode.position, 7, { delay:i*0.8+2 + Math.random()*2, y:status?70-Math.random()*10*i/10:10, ease:Back.easeInOut});
    }
  },

  _randomLights:function(){
    var len = this.sets.length;
    var toYLeft,toYRight;

    for (var i = 0; i < len; i++) {

      set = this.sets[i];

      toYLeft = 10+ Math.random()*100;
      toYRight = 10+ Math.random()*100;

      TweenMax.to(set.startNode.position, 3, { y:toYLeft, ease:Back.easeInOut});
      TweenMax.to(set.endNode.position, 3, { y:toYRight, ease:Back.easeInOut});
    }
  },

  _createSceneObjects: function(){

    var b1,b2,h,material;

    var facadeTexture = THREE.ImageUtils.loadTexture('assets/images/facade2.jpg');
    facadeTexture.repeat.x = 1;
    facadeTexture.repeat.y = 4;
    facadeTexture.wrapS = facadeTexture.wrapT = THREE.RepeatWrapping;


      var facadeSpecTexture = THREE.ImageUtils.loadTexture('assets/images/facade-spec.jpg');
      facadeSpecTexture.repeat.x = 1;
      facadeSpecTexture.repeat.y = 4;
      facadeSpecTexture.wrapS = facadeSpecTexture.wrapT = THREE.RepeatWrapping;

    if( !detector.isMobile ) {
      var facadeBumpTexture = THREE.ImageUtils.loadTexture('assets/images/facade-bump.jpg');
      facadeBumpTexture.magFilter = THREE.LinearMipMapLinearFilter;
      facadeBumpTexture.minFilter = THREE.LinearMipMapLinearFilter;
      facadeBumpTexture.repeat.x = 1;
      facadeBumpTexture.repeat.y = 4;
      facadeBumpTexture.wrapS = facadeBumpTexture.wrapT = THREE.RepeatWrapping;
    }

    this._collisionList = [];

    var phongShader = THREE.ShaderLib.phong;

    var uniforms = phongShader.uniforms;

    uniforms.map.value = facadeTexture;
    uniforms.offsetRepeat.value.set( 0, 0, 1, 4 );

    uniforms.specularMap.value = facadeSpecTexture;

    if( !detector.isMobile ) {
      uniforms.bumpMap.value = facadeBumpTexture;
      uniforms.bumpScale.value = 1.8;
    }

    uniforms.diffuse.value.set(0x010103);
    uniforms.specular.value.set( 0x333333);

    uniforms.shininess.value = 60;

    var vertexShader = [

      "#define PHONG",

      "varying vec3 vViewPosition;",
      "varying vec3 vNormal;",

      THREE.ShaderChunk[ "map_pars_vertex" ],
      THREE.ShaderChunk[ "lights_phong_pars_vertex" ],
      THREE.ShaderChunk[ "color_pars_vertex" ],
      THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

      "void main() {",

        THREE.ShaderChunk[ "map_vertex" ],
        THREE.ShaderChunk[ "color_vertex" ],
        THREE.ShaderChunk[ "defaultnormal_vertex" ],
      " vNormal = normalize( transformedNormal );",
        THREE.ShaderChunk[ "default_vertex" ],
        THREE.ShaderChunk[ "logdepthbuf_vertex" ],
      " vViewPosition = -mvPosition.xyz;",
        THREE.ShaderChunk[ "worldpos_vertex" ],
        THREE.ShaderChunk[ "lights_phong_vertex" ],

      "}"

    ].join("\n");

    var fragmentShader = [

      "#define PHONG",

      "uniform vec3 diffuse;",
      "uniform float opacity;",

      "uniform vec3 ambient;",
      "uniform vec3 emissive;",
      "uniform vec3 specular;",
      "uniform float shininess;",

      THREE.ShaderChunk[ "color_pars_fragment" ],
      THREE.ShaderChunk[ "map_pars_fragment" ],
      THREE.ShaderChunk[ "fog_pars_fragment" ],
      THREE.ShaderChunk[ "lights_phong_pars_fragment" ],
      THREE.ShaderChunk[ "bumpmap_pars_fragment" ],
      THREE.ShaderChunk[ "specularmap_pars_fragment" ],
      THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

      "void main() {",

      " gl_FragColor = vec4( vec3( 1.0 ), opacity );",

        THREE.ShaderChunk[ "logdepthbuf_fragment" ],
        THREE.ShaderChunk[ "map_fragment" ],
        THREE.ShaderChunk[ "alphatest_fragment" ],
        THREE.ShaderChunk[ "specularmap_fragment" ],
        THREE.ShaderChunk[ "lights_phong_fragment" ],
        THREE.ShaderChunk[ "lightmap_fragment" ],
        THREE.ShaderChunk[ "color_fragment" ],
        THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

        THREE.ShaderChunk[ "fog_fragment" ],

        "gl_FragColor.rgb = gl_FragColor.rgb + specularStrength*vec3(0.95,1.0,0.46)*0.6;",

      "}"

    ].join("\n");

    var buildingMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      lights:true,
      fog: true
    });

    buildingMat.map = true;
    buildingMat.specularMap = true;

    if( !detector.isMobile ) {
      buildingMat.bumpMap = true;
    }



    var uniformClone = THREE.UniformsUtils.clone( uniforms );
    uniformClone.offsetRepeat.value.set( 0, 0, 1, -4 );

    var mirrorMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      lights:true,
      fog: true
    });

    mirrorMat.map = true;
    mirrorMat.specularMap = true;


    for (var i = 0; i < this.totalSets; i++) {

      for (var k = 0; k < 2; k++) {

        material = (k===0)?buildingMat:mirrorMat;

        h = 180+Math.random()*40;
        b1 = new THREE.Mesh(new THREE.BoxGeometry(60,h,60), material);
        b1.name = 'b1_' + i;
        b1.position.x = -110 + Math.random()*20;
        b1.position.y = h*0.5*((k===0)?1:-1);
        b1.position.z = 80*-i;
        b1.rotation.y = -1*Math.PI/180;

        h = 180+Math.random()*40;
        b2 = new THREE.Mesh(new THREE.BoxGeometry(60,h,60), material);

        b2.position.x = 110-Math.random()*20;
        b2.position.y = h*0.5*((k===0)?1:-1);
        b2.position.z = 80*-i;
        b2.name = 'b2_' + i;
        b2.rotation.y = 1*Math.PI/180;
        this.scene.add(b2);

        if(k === 0) {
          b1.position.y +=2.5;
          b2.position.y +=2.5;
          this.scene.add(b1);
          this.scene.add(b2);
          this._collisionList.push(b1);
          this._collisionList.push(b2);
        }
        else {
          b1.position.y -=2.5;
          b2.position.y -=2.5;
          b1.scale.y = -1;
          b2.scale.y = -1;
          this.reflectiveScene.add(b1);
          this.reflectiveScene.add(b2);
        }
      }

      this.sets.push({b1:b1,b2:b2});
    }

    var sidewalkGeometry = new THREE.BoxGeometry(120,2.5,900, 6, 2, 20);

    sidewalkGeometry.computeFaceNormals();
    sidewalkGeometry.computeVertexNormals();

    var modifier = new THREE.SubdivisionModifier( 1 );
    modifier.supportUVs = true;
    modifier.modify( sidewalkGeometry );

    for (var i = 0; i < sidewalkGeometry.vertices.length; i++) {
      if (sidewalkGeometry.vertices[i].y > 1) {
        sidewalkGeometry.vertices[i].x += Math.random()*1.2 - 0.6;
        sidewalkGeometry.vertices[i].y += Math.random()*2.2;
        sidewalkGeometry.vertices[i].z += Math.random()*1.2 - 0.6;
      }
    }

    sidewalkGeometry.computeFaceNormals();
    sidewalkGeometry.computeVertexNormals();


    //sidewalk
    var sidewalk = new THREE.Mesh(sidewalkGeometry, this.sidewalkMaterial);
    sidewalk.position.x = 100;
    sidewalk.position.z = -380;
    sidewalk.position.y = 1.25;
    this.scene.add(sidewalk);

    sidewalk = new THREE.Mesh(sidewalkGeometry, this.sidewalkMirrorMaterial);
    sidewalk.position.x = 100;
    sidewalk.position.z = -380;
    sidewalk.position.y = -1.25;
    this.reflectiveScene.add(sidewalk);


    sidewalk = new THREE.Mesh(sidewalkGeometry, this.sidewalkMaterial);
    sidewalk.position.x = -100;
    sidewalk.position.z = -380;
    sidewalk.position.y = 1.25;
    this.scene.add(sidewalk);

    sidewalk = new THREE.Mesh(sidewalkGeometry, this.sidewalkMirrorMaterial);
    sidewalk.position.x = -100;
    sidewalk.position.z = -380;
    sidewalk.position.y = -1.25;
    this.reflectiveScene.add(sidewalk);


    //ground
    var ground = new THREE.Mesh(new THREE.PlaneBufferGeometry(300,1000,1,1), this.groundMaterial);
    ground.rotation.x = Math.PI*-0.5;
    ground.position.z = -300;
    this.scene.add(ground);

    //moon
    var radius = 200;
    var xSegments = 20;
    var ySegments = 20;
    var geo = new THREE.SphereGeometry(radius, xSegments, ySegments);

    var moon = new THREE.Mesh(geo, this.moonMaterial);
    moon.position.set(0,850,-2700);
    moon.rotation.y = 0;
    this.scene.add(moon);
    this.moon = moon;
    this.moon.name = 'moon';

    this._collisionList.push(moon);

    //merry xmas
    var messagePlane = new THREE.Mesh( new THREE.PlaneBufferGeometry(30,30,1,1), new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture('assets/images/merryxmas.jpg'),blending:THREE.AdditiveBlending,transparent:true,opacity:0.5}));
    messagePlane.position.y = 1;
    messagePlane.position.z = 100;
    messagePlane.rotation.x = Math.PI*-0.5;
    this.scene.add(messagePlane);

    //sign

    var signGeo = loader.parse( JSON.parse(modelGeometries.sign) ).geometry;
    var signTex = THREE.ImageUtils.loadTexture('assets/images/sign.jpg');
    var sign = new THREE.Mesh( signGeo, new THREE.MeshBasicMaterial({color:detector.isMobile?0xffffff:0x888888,ambient:0x222222,shininess:90,map:signTex}));
    sign.scale.set(0.15,0.15,0.15);
    sign.rotation.y = Math.PI*0.4;

    if( detector.isMobile ) {
      sign.position.set(35,0,100);
    }
    else {
      sign.position.set(50,2.25,55);
    }

    this.scene.add(sign);
    sign.name = 'sign';
    this._collisionList.push(sign);

    //sign reflection
    var sign2 = new THREE.Mesh( signGeo, new THREE.MeshBasicMaterial({color:detector.isMobile?0xffffff:0x888888,ambient:0x222222,shininess:90,map:signTex}));
    sign2.scale.set(0.15,-0.15,0.15);
    sign2.rotation.y = sign.rotation.y;
    sign2.position.copy( sign.position);
    sign2.position.y = sign.position.y*-1;

    this.reflectiveScene.add(sign2);

    this.dummieHit = new THREE.Mesh( new THREE.SphereGeometry(3,7,7), new THREE.MeshPhongMaterial({emissive:0xffffff,color:0xffffff,transparent:true}));
    this.dummieHit.visible = false;
    this.scene.add(this.dummieHit);
  },

  _setupPhysics: function(){

    // Setup our world
    var world = new CANNON.World();
    world.gravity.set(0,-15,0);
    world.broadphase = new CANNON.NaiveBroadphase();

    var self = this;

    var size = 0.5;
    var dist = 10;

    var N = LAMPS_PER_CABLE;
    world.solver.iterations = 1;//N; // To be able to propagate force throw the chain of N spheres, we need at least N solver iterations.
    var sphereShape = new CANNON.Sphere(size);
    var mass = 4;
    var c;
    var set,initY;
    for (var i = 0; i < this.sets.length; i++) {
      var lastBody = null;
      set = this.sets[i];

      set.bulbs = [];
      set.cables = [];
      set.mirrorBulbs = [];
      set.lights = [];
      set.startNode = null;
      set.endNode = null;

      initY = 10;//60+Math.random()*5;

      for (var j = N - 1; j >= 0; j--) {

        // Create a new body
        var spherebody = new CANNON.Body({ mass: (j===0 || j===(N-1)) ? 0 : mass });
        spherebody.addShape(sphereShape);
        spherebody.position.set(-70+j*140/(N-1),initY,70*-i);
        //spherebody.angularVelocity.set(0,10,0);
        spherebody.angularDamping = 0.5;
        spherebody.linearDamping = 0.7;
        spherebody.fixedRotation = true;

        if( j === 0 ) {
          set.startNode = spherebody;

        }
        else if( j === N-1 ) {
          set.endNode = spherebody;
        }

        world.add(spherebody);
        this.addBulb(set, spherebody);

        // Connect this body to the last one added
        if(lastBody!==null ){


          c = new CANNON.DistanceConstraint(spherebody,lastBody,70/(N-1)*2);
          world.addConstraint(c);

        }
        // Keep track of the lastly added body
        lastBody = spherebody;
      }

      this.addCable(set,this.cableMaterial);
      this.addCable(set,this.cableMaterial2);

 //     c = new CANNON.DistanceConstraint(this.sets[i].bulbs[LAMPS_PER_CABLE/2-2].physTarget,this.sets[i].bulbs[LAMPS_PER_CABLE/2].physTarget,70/(N-1)*2);
 //     world.addConstraint(c);

    }

    var boxShape = new CANNON.Box(new CANNON.Vec3(60,2.5,650));
    var boxbody = new CANNON.Body({mass: 0});
    boxbody.addShape(boxShape);
    boxbody.position.x = 100;
    boxbody.position.z = -200;
    world.add(boxbody);

    boxbody = new CANNON.Body({mass: 0});
    boxbody.addShape(boxShape);
    boxbody.position.x = -100;
    boxbody.position.z = -200;
    world.add(boxbody);

    // Compute the force after each step
    world.addEventListener("postStep",function(event){
      /*for (var i = self.springs.length - 1; i >= 0; i--) {
        self.springs[i].applyForce();
      }*/
      var point = new CANNON.Vec3(0,0,0);
      var td = 1/80;
      var force;
      var time = self._clock.getElapsedTime()*0.5;
      for (var i = self.sets.length - 1; i >= 0; i--) {

        for (var j = LAMPS_PER_CABLE - 1; j >= 0; j--) {
          force = -Math.sin(time)+Math.cos(time*0.2);
          impulse = new CANNON.Vec3(force*Math.random(),0,force+0.4*i);
          self.sets[i].bulbs[j].physTarget.applyImpulse(impulse,point);

        }
      }

    });

    this.world = world;
  },

  addCable: function(set, material){

    var path = [];

    for (var i = 0; i < LAMPS_PER_CABLE; i++) {
      path.push(set.bulbs[i].physTarget.position);
    }

    var tubeGeo = new THREE.TubeGeometry(new THREE.SplineCurve3(path), LAMPS_PER_CABLE, 3.2, 5, false);
    var mesh = new THREE.Mesh(tubeGeo, material );
    this.scene.add(mesh);
    mesh.dynamic = true;

    set.radiusRandom = Math.random()*0.5;

    set.cables.push(mesh);

  },

  addBulb: function( set, physTarget ){

    var type = (set.mirrorBulbs.length === LAMPS_PER_CABLE/2-1)?'star':'bulb';

    var newBulb,mirrorBulb;

    if( type === 'star' ) {

      newBulb = new THREE.Mesh( this.starGeometry, this.starMaterial );
      newBulb.rotation.x = Math.PI*0.5;
      newBulb.scale.set(2,2,2);

      var light = new THREE.PointLight(this.bulbColor, detector.isMobile?2.6:1.5,200);
      set.light = light;
      this.scene.add(light);

      mirrorBulb = new THREE.Mesh( this.starGeometry, this.bulbMirrorMaterial );
      mirrorBulb.rotation.x = Math.PI*-0.5;
      mirrorBulb.scale.set(2,2,2);
      mirrorBulb.visible = false;
      set.mirrorStar = mirrorBulb;

      newBulb.initRotY = (Math.random()*15-7)*Math.PI/180;
    }
    else {
      newBulb = new THREE.Mesh( this.bulbGeometry, this.bulbMaterial );

      var innerBulb = new THREE.Mesh( this.innerBulbGeometry, this.innerBulbMaterial );
      innerBulb.visible = false;
      newBulb.innerBulb = innerBulb;
      newBulb.add(innerBulb);

      mirrorBulb = new THREE.Mesh( this.bulbGeometry, this.bulbMirrorMaterial );
      mirrorBulb.visible = false;
    }

    newBulb.physTarget = physTarget;
    this.scene.add(newBulb);

    set.bulbs.push( newBulb );

    this.reflectiveScene.add(mirrorBulb);
    set.mirrorBulbs.push(mirrorBulb);

  },

  _draw: function(){
    var delta = this._clock.getDelta();
    var time = this._clock.getElapsedTime() * 10;
    var self = this;

    delta = Math.min(delta,0.1);

    //this.ground.material.uniforms.time.value += delta/100;
    this.camera.position.x += (10*this._normalizedMouse2D.x-this.camera.position.x)*0.1;
    this.camera.position.y += ((20+5*this._normalizedMouse2D.y*-1)-this.camera.position.y)*0.1;
    this.camera.rotation.x += (((5*this._normalizedMouse2D.y)*-Math.PI/180)-this.camera.rotation.x)*0.1;

    this.delta = delta;

    this.world.step(delta*2);

    this.lightSequence.update(this._clock.getElapsedTime());

    if( this._mouseMoved ) {
      this._mouseMoved = false;
    }

    var i,j,set,v,cx,cy,radius,cable,c,k,vertex,offset;
    for (i = this.sets.length - 1; i >= 0; i--) {

      set = this.sets[i];

      for (j = LAMPS_PER_CABLE - 1; j >= 0; j--) {

        set.bulbs[j].position.copy(set.bulbs[j].physTarget.position);

        set.bulbs[j].position.y += - 1.5 * Math.sin( j );
        set.bulbs[j].position.z += 1.5 * Math.cos( j );

        if( set.bulbs[j].position.y < 1 ) {
          set.bulbs[j].position.y = 1;
        }

        radius = 1+set.radiusRandom;

        if( j === 0 || j === LAMPS_PER_CABLE-1) {
          radius = 0;
        }

        if( j === 1 || j === LAMPS_PER_CABLE-2) {
          radius = 0.5;
        }

        for ( c = set.cables.length - 1; c >= 0; c--) {

          cable = set.cables[c];
          cable.geometry.verticesNeedUpdate = true;
          for ( k = 0; k < 5; k++) {

            v = k / 5 * 2 * Math.PI;
            cz =  radius * Math.cos( v );
            cy = radius * Math.sin( v );

            vertex = cable.geometry.vertices[k+j*5-5];
            if( vertex ){
              vertex.copy(set.bulbs[j].position);
              offset = c*3.14*(0.5+0.5*i);
              vertex.y += cy + Math.sin(j+offset)*radius;
              vertex.z += cz + Math.cos(j+offset)*radius;
            }
          }
        }

        set.mirrorBulbs[j].position.copy(set.bulbs[j].position);
        this.sets[i].mirrorBulbs[j].position.y *= -1;

      }

      //render last vertices of cable

      for ( c = set.cables.length - 1; c >= 0; c--) {
        cable = set.cables[c];
        for (u = cable.geometry.vertices.length - 1; u >= cable.geometry.vertices.length-10; u--) {

          for (k = 0; k < 5; k++) {
            v = k / 5 * 2 * Math.PI;
            cz =  radius * Math.cos( v );
            cy = radius * Math.sin( v );
            vertex = cable.geometry.vertices[u+k];
            if( vertex) {
              vertex.copy(set.bulbs[LAMPS_PER_CABLE - 1].position);
            }
          }
        }
      }

      var star = set.bulbs[LAMPS_PER_CABLE/2-1];
      var mirrorStar = this.sets[i].mirrorBulbs[LAMPS_PER_CABLE/2-1];

      var toRotY = star.initRotY + Math.atan2(set.bulbs[LAMPS_PER_CABLE/2-2].position.y - set.bulbs[LAMPS_PER_CABLE/2-1].position.y, set.bulbs[LAMPS_PER_CABLE/2-2].position.x - set.bulbs[LAMPS_PER_CABLE/2-1].position.x);

      star.rotation.y += (toRotY-star.rotation.y)*0.2;

      star.position.copy(star.physTarget.position);
      star.position.y -= 2;

      star.position.z += 2;
      set.light.position.copy(star.physTarget.position);
      set.light.position.y -= 2;

      mirrorStar.rotation.y = star.rotation.y;

      if( star.position.y < 1 ) {
        star.position.y = 1;
        mirrorStar.position.y = star.position.y*-1;
      }

      star.rotation.x = (1-Math.min(10,star.position.y)/10)*Math.PI*-0.8 +Math.PI*0.5;
      mirrorStar.rotation.x = star.rotation.x*-1;
    }

    var t = this._clock.getElapsedTime()*0.5;
    var force = -Math.sin(t)*100;

    this.particleEngine.render(delta,force);

    if( this.usePostProcessing ) {
      this.postEffectManager.renderReflect();
      this.postEffectManager.renderAbove();
    } else {
      this.renderer.clear();
      this.renderer.render( this.scene, this.camera );
    }

    raf( this._draw );
  },

  _updateMousePicker: function( x, y ){

    var vector;
    var self = this;

    if( x || y ) {
      vector = new THREE.Vector3(x,-y,0.5);
    }
    else {
      vector = new THREE.Vector3(this._normalizedMouse2D.x,this._normalizedMouse2D.y*-1,0.5);
    }

    vector.unproject(this.camera);

    var raycaster = new THREE.Raycaster(this.camera.position,vector.sub(this.camera.position).normalize() );
    var intersects = raycaster.intersectObjects( this._collisionList );

    if ( intersects.length > 0 ) {

      this.dummieHit.visible = true;
      this.dummieHit.scale.set(0.001,0.001,0.001);
      TweenMax.fromTo(this.dummieHit.material,0.2,{opacity:1},{opacity:0});
      TweenMax.to(this.dummieHit.scale,0.2,{x:1,y:1,z:1,ease:Linear.easeNone,onComplete:function(){
        self.dummieHit.visible = false;
      }});

      this.dummieHit.position.copy(intersects[0].point);

      var nameList = intersects[0].object.name.split('_');

      if( nameList[0] === 'b1' ) {
        newPoint = intersects[0].point;
        animPos = this.sets[nameList[1]].startNode.position;
        TweenMax.to(animPos,1,{y:newPoint.y,x:newPoint.x,z:newPoint.z});
      }
      else if( nameList[0] === 'b2' ) {
        newPoint = intersects[0].point;
        animPos = this.sets[nameList[1]].endNode.position;
        TweenMax.to(animPos,1,{y:newPoint.y,x:newPoint.x,z:newPoint.z});
      }
      else if( intersects[0].object.name === 'moon') {
        TweenMax.to(this.moon.rotation,4,{y:this.moon.rotation.y + Math.PI,ease:Sine.easeInOut});
      }
      else if( intersects[0].object.name === 'sign') {
        var fIndex = intersects[0].faceIndex;

        var url = null;

        if( fIndex === 186 || fIndex === 187 ) {
          //sign 1
          url = "http://inear.se";
          window.open(url);
        } else if( fIndex === 291 || fIndex === 292 ) {
          //sign 2
          this._randomLights();
        } else if( fIndex === 78 || fIndex === 79 ) {
          //sign 3
          url = "http://christmasexperiments.com/2013/21/";
          location.href = url;
        } else if( fIndex === 418 || fIndex === 419 ) {
          //sign 4
          url = "http://inear.se/xmas";
          location.href = url;
        } else if( fIndex === 532 || fIndex === 533 ) {
          //sign 5
          url = "http://twitter.com/inear";
          window.open(url);
        } else if( fIndex === 641 || fIndex === 642 ) {
          //sign 6
          url = "http://threejs.org";
          window.open(url);
        } else if( fIndex === 748 ||fIndex === 749 ) {
          //sign 7
          url = "http://cannonjs.org/";
          window.open(url);
        }


      }
    }
  },

  _onResize: function() {

    var winW = window.innerWidth;
    var winH = window.innerHeight;

    this.size.width = winW;
    this.size.height = winH;
    this.size.sizeRatio = this.sizeRatio;

    this.camera.aspect = winW / winH;
    this.camera.updateProjectionMatrix();

    this.particleEngine.resize(this.size);

    this.renderer.setSize( winW/this.sizeRatio, winH/this.sizeRatio);

    if( this.postEffectManager ) {
      this.postEffectManager.resize({width:winW,height:winH,sizeRatio:this.sizeRatio});
    }

  },

  _dispose: function() {
    this.unmapAllListeners();
  }
});
