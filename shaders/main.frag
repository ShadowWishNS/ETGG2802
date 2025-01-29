#version 450 core
#extension GL_GOOGLE_include_directive : enable

#include "pushconstants.txt"
#include "uniforms.txt"


layout(location=VS_OUTPUT_TEXCOORD) in vec2 texcoord;
layout(location=VS_OUTPUT_TEXCOORD2) in vec2 texcoord2;
layout(location=VS_OUTPUT_NORMAL) in vec3 normal;
layout(location=VS_OUTPUT_WORLDPOS) in vec3 worldPosition;
layout(location=VS_OUTPUT_TANGENT) in vec4 tangent;

layout(location=0) out vec4 color;

layout(set=0,binding=NEAREST_SAMPLER_SLOT) uniform sampler nearestSampler;
layout(set=0,binding=LINEAR_SAMPLER_SLOT) uniform sampler linearSampler;
layout(set=0,binding=MIPMAP_SAMPLER_SLOT) uniform sampler mipSampler;
layout(set=0,binding=BASE_TEXTURE_SLOT) uniform texture2DArray baseTexture;
layout(set=0,binding=EMISSIVE_TEXTURE_SLOT) uniform texture2DArray emitTexture;
layout(set=0,binding=NORMAL_TEXTURE_SLOT) uniform texture2DArray normalTexture;
layout(set=0,binding=METALLICROUGHNESS_TEXTURE_SLOT) uniform texture2DArray metallicRoughnessTexture;

#define AMBIENT_ABOVE vec3(0.3,0.3,0.3)
#define AMBIENT_BELOW vec3(0.1,0.1,0.1)


void computeLightContribution(int i, vec3 N,
                            out vec3 diff, out vec3 spec){

    vec3 lightPosition = lightPositionAndDirectionalFlag[i].xyz;
    float positional = lightPositionAndDirectionalFlag[i].w;
    vec3 lightColor = lightColorAndIntensity[i].xyz;
    float intensity = lightColorAndIntensity[i].w;
    vec3 spotDir = spotDirection[i].xyz ;
    float cosSpotInnerAngle = cosSpotAngles[i].x;
    float cosSpotOuterAngle = cosSpotAngles[i].y;

    vec3 L = normalize( lightPosition - worldPosition );

    float dp = dot(L,N);
    dp = clamp(dp, 0.0, 1.0);

    vec3 V = normalize(eyePosition - worldPosition);
    vec3 R = reflect(-L,N);
    float sp = dot(V,R);
    sp = clamp(sp, 0.0, 1.0);
    sp = pow(sp,16.0);
    sp = sp * sign(dp);

    float D = distance( lightPosition, worldPosition );
    float A = 1.0/( D*(attenuation[2] * D   +
                       attenuation[1]     ) +
                       attenuation[0]     );
    A = clamp(A, 0.0, 1.0);

    dp *= A;
    sp *= A;

    float cosineTheta = dot(-L,spotDir);
    float spotAttenuation = smoothstep(
                    cosSpotOuterAngle,
                    cosSpotInnerAngle,
                    cosineTheta);
    dp *= spotAttenuation;
    sp *= spotAttenuation;

    diff = dp * lightColor;
    spec = sp * lightColor;
}

vec3 doBumpMapping(vec3 b, vec3 N)
{
    if( tangent.w == 0.0 )
        return N;

    N = normalize(N);
    vec3 T = tangent.xyz;
	T = T - (dot(N, T)*N);
	T = normalize(T);
	vec3 B = cross(N, T);
	
	vec3 beta = vec3(((b.x - 0.5)*2),((b.y - 0.5)*2),((b.z - 0.5)*2));
	
	beta = beta * normalFactor;
	
	vec3 pN = beta * mat3(	T.x, B.x, N.x,
					T.y, B.y, N.y,
					T.z, B.z, N.z	
				  );
				  
	pN = (vec4(pN, 0) * worldMatrix).xyz;


    return pN;       //bump mapped normal
}


void main(){

    vec3 b = texture( sampler2DArray(normalTexture, mipSampler),
                    vec3(texcoord2,0.0) ).xyz;

    vec3 N = normalize(normal);
    N = doBumpMapping(b.xyz, N);

    vec3 tc = vec3(texcoord,0.0);
    vec4 c = texture(
        sampler2DArray(baseTexture,mipSampler), tc
    );
    c = c * baseColorFactor;


    float mappedY = 0.5 * (N.y+1.0);
    vec3 ambient = c.rgb * mix( AMBIENT_BELOW, AMBIENT_ABOVE, mappedY );

    vec3 totaldp = vec3(0.0);
    vec3 totalsp = vec3(0.0);

    for(int i=0;i<MAX_LIGHTS;++i){
        vec3 dp, sp;
        computeLightContribution(i,N,dp,sp);

        totaldp += dp ;
        totalsp += sp ;
    }

    vec3 ec = texture(
        sampler2DArray(emitTexture,mipSampler), tc
    ).rgb;
    ec = ec * emissiveFactor;

    c.rgb = c.rgb * (ambient + totaldp) + totalsp ;
    c.rgb += ec.rgb;
    c.rgb = clamp(c.rgb, vec3(0.0), vec3(1.0) );
    color = c;

}
