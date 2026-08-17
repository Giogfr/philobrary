export function BalloonHeadline({ fillColor = '#fff' }: { fillColor?: string }) {
  return (
    <div className="w-full max-w-[1000px] mx-auto mb-8">
      <svg viewBox="0 0 1000 340" xmlns="http://www.w3.org/2000/svg" role="img" className="w-full h-auto animate-reveal">
        <defs>
          <filter id="balloon" x="-35%" y="-90%" width="170%" height="280%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="fat"/>
            <feGaussianBlur in="fat" stdDeviation="5" result="soft"/>
            <feComponentTransfer in="soft" result="body">
              <feFuncA type="table" tableValues="0 0 0 1 1"/>
            </feComponentTransfer>
            <feGaussianBlur in="body" stdDeviation="10" result="h"/>
            <feTurbulence type="fractalNoise" baseFrequency="0.007 0.015" numOctaves="2" seed="23" result="fold"/>
            <feDisplacementMap in="h" in2="fold" scale="8" xChannelSelector="R" yChannelSelector="G" result="hf"/>
            <feSpecularLighting in="hf" surfaceScale="14" specularConstant="1.25" specularExponent="8" lightingColor={fillColor} result="spec">
              <fePointLight x="400" y="-160" z="240"/>
            </feSpecularLighting>
            <feDiffuseLighting in="hf" surfaceScale="12" diffuseConstant="1.15" lightingColor="#6e6e6e" result="diff">
              <fePointLight x="520" y="-40" z="300"/>
            </feDiffuseLighting>
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.065" numOctaves="3" seed="9" result="fine"/>
            <feDisplacementMap in="h" in2="fine" scale="3" xChannelSelector="R" yChannelSelector="G" result="hfine"/>
            <feSpecularLighting in="hfine" surfaceScale="4" specularConstant="0.4" specularExponent="15" lightingColor={fillColor} result="wr">
              <fePointLight x="360" y="-100" z="200"/>
            </feSpecularLighting>
            <feComposite in="diff" in2="body" operator="in" result="dIn"/>
            <feComposite in="spec" in2="body" operator="in" result="sIn"/>
            <feComposite in="wr"   in2="body" operator="in" result="wIn"/>
            <feMerge><feMergeNode in="dIn"/><feMergeNode in="sIn"/><feMergeNode in="wIn"/></feMerge>
          </filter>
        </defs>
        <g fontFamily="Arial Black, Helvetica Neue, Impact, sans-serif" fontWeight="900" fontSize="160" letterSpacing="-4" textAnchor="middle" fill={fillColor} filter="url(#balloon)">
          <text x="500" y="130">PHILO</text>
          <text x="500" y="290">BRARY</text>
        </g>
      </svg>
    </div>
  );
}
