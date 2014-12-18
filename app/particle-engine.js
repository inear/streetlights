var detector = require('./utils/detector');

module.exports = ParticleEngine;

function ParticleEngine( scene ){

  this.scene = scene;

  this.init();

}


var p = ParticleEngine.prototype;

p.init = function(){

  var texture = THREE.ImageUtils.loadTexture('assets/images/snowflake.png');

  var attributes = {

    time:        { type: 'f', value: null },
    size:        { type: 'f', value: null },
    customColor: { type: 'c', value: null }

  };

  this.snowUniforms = {
    color:      { type: "c", value: new THREE.Color( 0xffffff ) },
    texture:    { type: "t", value: texture },
    globalTime: { type: "f", value: 0 },
  };

  var shaderMaterial = new THREE.ShaderMaterial( {

    uniforms:     this.snowUniforms,
    attributes:     attributes,
    vertexShader:   require('./shaders/snow_vs.glsl'),
    fragmentShader: require('./shaders/snow_fs.glsl'),

    blending:     THREE.AdditiveBlending,
    depthTest:    true,
    transparent:  true,

  });

  this.particlesTotal = detector.isMobile?3000:15000;

  var geometry = new THREE.BufferGeometry();

  var positions = new Float32Array( this.particlesTotal * 3 );
  var values_color = new Float32Array( this.particlesTotal * 3 );
  var values_size = new Float32Array( this.particlesTotal );
  var values_time = new Float32Array( this.particlesTotal );

  var color = new THREE.Color(0xffffff);

  for( var v = 0; v < this.particlesTotal; v++ ) {

    values_size[ v ] = 2;

    positions[ v * 3 + 0 ] = ( Math.random() * 2 - 1 ) * 100;
    positions[ v * 3 + 1 ] = 300;//( Math.random() * 2 - 1 ) * 200;
    positions[ v * 3 + 2 ] = ( Math.random() * 2 - 1 ) * 500;

    values_color[ v * 3 + 0 ] = color.r;
    values_color[ v * 3 + 1 ] = color.g;
    values_color[ v * 3 + 2 ] = color.b;

    values_time[v] = Math.random();

  }

  geometry.addAttribute( 'time', new THREE.BufferAttribute( values_time, 1 ) );
  geometry.addAttribute( 'size', new THREE.BufferAttribute( values_size, 1 ) );
  geometry.addAttribute( 'customColor', new THREE.BufferAttribute( values_color, 3 ) );
  geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

  this.particleSystem = new THREE.PointCloud( geometry, shaderMaterial );
  this.particleSystem.position.set(0,0,0);
  this.geometry = geometry;
  this.shaderMaterial = shaderMaterial;

  this.scene.add( this.particleSystem );
};

p.resize = function(data){
  for( var v = 0; v < this.particlesTotal; v++ ) {
    var sizes = this.geometry.attributes.size.array;
    sizes[ v ] = data.width/1200;
  }

   this.geometry.attributes.size.needsUpdate = true;
};

p.render = function( delta , wind){

  this.particleSystem.position.z = wind;
  this.shaderMaterial.uniforms.globalTime.value += delta*-0.04;
/*

  var positions = this.geometry.attributes.position.array;

  for( var i = 0; i < this.particlesTotal; i++ ) {
    positions[ i * 3 + 2 ] += 0.1;

  }

  this.geometry.attributes.position.needsUpdate = true;
*/

};

p.destroy = function() {
  this.particleSystem.geometry.dispose();
};
