attribute float size;
attribute float time;
attribute vec3 customColor;
uniform float globalTime;

varying vec3 vColor;
varying float fAlpha;

void main() {

  vColor = customColor;

  vec3 pos = position;

  // time
  float localTime = time + globalTime;
  float modTime = mod( localTime, 1.0 );
  float accTime = modTime * modTime;

  pos.x += cos(modTime*8.0 + (position.z))*17.0;
  pos.z += sin(modTime*6.0 + (position.x))*20.0;

  fAlpha = 0.3;//(pos.z)/1800.0;

  vec3 animated = vec3( pos.x, pos.y * accTime, pos.z );

  vec4 mvPosition = modelViewMatrix * vec4( animated, 1.0 );

  gl_PointSize = min(150.0, size * ( 150.0 / length( mvPosition.xyz ) ) );

  gl_Position = projectionMatrix * mvPosition;
}
