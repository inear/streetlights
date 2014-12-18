uniform vec3 color;
uniform sampler2D texture;

varying vec3 vColor;
varying float fAlpha;

void main() {

  gl_FragColor = vec4( color * vColor, fAlpha );
  gl_FragColor = gl_FragColor * texture2D( texture, gl_PointCoord );

}