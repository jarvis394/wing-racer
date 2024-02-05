precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;

uniform vec2 uResolution;
uniform vec2 uRed;
uniform vec2 uGreen;
uniform vec2 uBlue;

void main(void) {
  vec2 pixelCoord = vTextureCoord * uResolution;
  vec2 p = (pixelCoord * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  gl_FragColor.r = texture2D(uSampler, vTextureCoord + uRed * p).r;
  gl_FragColor.g = texture2D(uSampler, vTextureCoord + uGreen * p).g;
  gl_FragColor.b = texture2D(uSampler, vTextureCoord + uBlue * p).b;
  gl_FragColor.a = texture2D(uSampler, vTextureCoord).a;
}