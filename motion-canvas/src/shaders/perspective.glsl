#version 300 es
precision highp float;

in vec2 sourceUV;
in vec2 destinationUV;
in vec2 screenUV;

uniform sampler2D sourceTexture;
uniform sampler2D destinationTexture;
uniform vec2 resolution;
uniform float time;
uniform float deltaTime;
uniform float framerate;
uniform int frame;
uniform mat4 sourceMatrix;
uniform mat4 destinationMatrix;

uniform float tilt;

out vec4 outColor;

void main() {
    vec2 uv = sourceUV;

    float narrowTop = 1.0 - uv.y * tilt * 0.65;

    vec2 warped = uv;
    warped.x = 0.5 + (uv.x - 0.5) / max(narrowTop, 0.05);

    float fade = mix(1.0, narrowTop, tilt);

    if (warped.x < 0.0 || warped.x > 1.0) {
        outColor = vec4(0.0);
    } else {
        outColor = texture(sourceTexture, warped);
        outColor.a *= fade;
    }
}
