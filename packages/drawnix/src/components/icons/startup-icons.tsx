import React from 'react';


export const HandIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M7 11.5V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v7.5" />
    <path d="M11 10.5V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v7.5" />
    <path d="M15 11.5V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v7.5" />
    <path d="M19 13.5V9a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v5.5a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-2a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3.5" />
  </svg>
);

export const SelectionIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="m13 13 6 6" />
  </svg>
);

export const MindIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M9 12h3c1 0 1-1 1-1V7c0-1 1-1 2-1h1" />
    <path d="M9 12h3c1 0 1 1 1 1v5c0 1 1 1 2 1h1" />
  </svg>
);

export const FolderIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

export const ToolboxIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M14.5 7V5a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v2" />
    <rect width="20" height="13" x="2" y="7" rx="2" />
    <path d="M2 13h20" />
    <path d="M6 13v0" />
    <path d="M18 13v0" />
  </svg>
);

export const TaskIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M11 6h9" />
    <path d="M11 12h9" />
    <path d="M11 18h9" />
    <path d="m3 7 2 2 4-4" />
    <path d="m3 19 2 2 4-4" />
  </svg>
);

export const ShapeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <rect x="3" y="3" width="10" height="10" rx="2" />
    <circle cx="15" cy="15" r="6" />
  </svg>
);

export const TextIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="9" y1="20" x2="15" y2="20" />
  </svg>
);

export const EraseIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.9-9.9c1-1 2.5-1 3.4 0l4.4 4.4c1 1 1 2.5 0 3.4L10.5 21z" />
    <path d="m11 7 4 4" />
    <path d="m5 19 3 2" />
    <path d="M13 19h7" />
  </svg>
);

export const StraightArrowLineIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const RectangleIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    {...props}
  >
    <path
      d="M3 3h18v18H3z"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    ></path>
  </svg>
);

export const TerminalIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={size}
    height={size}
    {...props}
  >
    <g id="terminal" stroke="none" fill="currentColor">
      <path d="M11,3 C13.7614237,3 16,5.23857625 16,8 C16,10.7614237 13.7614237,13 11,13 L5,13 C2.23857625,13 0,10.7614237 0,8 C0,5.23857625 2.23857625,3 5,3 L11,3 Z M11,4.2 L5,4.2 C2.90131795,4.2 1.2,5.90131795 1.2,8 C1.2,10.0330982 2.79664702,11.6932796 4.8044525,11.7950555 L5,11.8 L11,11.8 C13.098682,11.8 14.8,10.098682 14.8,8 C14.8,5.96690176 13.203353,4.30672042 11.1955475,4.20494454 L11,4.2 Z" />
    </g>
  </svg>
);

export const EllipseIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    version="1.1"
    width={size}
    height={size}
    {...props}
  >
    <g id="ellipse" stroke="none" fill="currentColor">
      <path d="M8,1 C11.8659932,1 15,4.13400675 15,8 C15,11.8659932 11.8659932,15 8,15 C4.13400675,15 1,11.8659932 1,8 C1,4.13400675 4.13400675,1 8,1 Z M8,2.2 C4.79674845,2.2 2.2,4.79674845 2.2,8 C2.2,11.2032515 4.79674845,13.8 8,13.8 C11.2032515,13.8 13.8,11.2032515 13.8,8 C13.8,4.79674845 11.2032515,2.2 8,2.2 Z" />
    </g>
  </svg>
);

export const TriangleIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" version="1.1" width={size} height={size} {...props}>
    <g id="triangle" stroke="none" fill="currentColor">
      <path d="M8.23125547,1.21366135 C8.3114266,1.25857939 8.37766784,1.32472334 8.42270367,1.40482837 L15.6471754,14.2549655 C15.7825042,14.4956743 15.6970768,14.800513 15.456368,14.9358418 C15.3815505,14.977905 15.2971646,15 15.2113335,15 L0.787227066,15 C0.511084691,15 0.287227066,14.7761424 0.287227066,14.5 C0.287227066,14.414418 0.309194147,14.3302684 0.351025556,14.2556064 L7.55066033,1.40546924 C7.6856352,1.1645618 7.99034802,1.07868648 8.23125547,1.21366135 Z M7.98695902,3.07926294 L1.98095902,13.7992629 L14.014959,13.7992629 L7.98695902,3.07926294 Z" />
    </g>
  </svg>
);

export const DiamondIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" version="1.1" width={size} height={size} {...props}>
    <g stroke="none" fill="currentColor">
      <path
        d="M13.7636471,2.6449804 C13.7716713,2.69552516 13.7718878,2.74700226 13.7642892,2.79761274 L12.3875778,11.9671885 C12.3550099,12.1841069 12.184864,12.3544698 11.9679874,12.3873141 L2.78433018,13.7781116 C2.511301,13.8194599 2.25644773,13.6316454 2.21509947,13.3586162 C2.20737253,13.307594 2.20759072,13.2556831 2.21574631,13.2047277 L3.67471119,4.08923146 C3.70888725,3.87570215 3.87646006,3.70834166 4.09003253,3.67443635 L13.1914362,2.22955927 C13.4641633,2.18626298 13.7203508,2.37225335 13.7636471,2.6449804 Z M12.4355704,3.5645263 L4.77957044,4.7795263 L3.55157044,12.4485263 L11.2775704,11.2775263 L12.4355704,3.5645263 Z"
        transform="translate(7.989647, 8.003560) rotate(-315.000000) translate(-7.989647, -8.003560) "
      />
    </g>
  </svg>
);

export const ParallelogramIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" version="1.1" width={size} height={size} {...props}>
    <g stroke="none" fill="currentColor">
      <path d="M15.3062871,3.5 C15.5824294,3.5 15.8062871,3.72385763 15.8062871,4 C15.8062871,4.05374105 15.7976231,4.10713065 15.7806287,4.15811388 L13.113962,12.1581139 C13.045905,12.362285 12.8548356,12.5 12.6396204,12.5 L0.693712943,12.5 C0.417570568,12.5 0.193712943,12.2761424 0.193712943,12 C0.193712943,11.946259 0.202376883,11.8928694 0.219371294,11.8418861 L2.88603796,3.84188612 C2.95409498,3.63771505 3.14516441,3.5 3.36037961,3.5 L15.3062871,3.5 Z M14.335,4.7 L3.864,4.7 L1.664,11.3 L12.134,11.3 L14.335,4.7 Z" />
    </g>
  </svg>
);

export const RoundRectangleIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" version="1.1" width={size} height={size} {...props}>
    <g stroke="none" fill="currentColor">
      <path d="M11,3 C13.7614237,3 16,5.23857625 16,8 C16,10.7614237 13.7614237,13 11,13 L5,13 C2.23857625,13 0,10.7614237 0,8 C0,5.23857625 2.23857625,3 5,3 L11,3 Z M11,4.2 L5,4.2 C2.90131795,4.2 1.2,5.90131795 1.2,8 C1.2,10.0330982 2.79664702,11.6932796 4.8044525,11.7950555 L5,11.8 L11,11.8 C13.098682,11.8 14.8,10.098682 14.8,8 C14.8,5.96690176 13.203353,4.30672042 11.1955475,4.20494454 L11,4.2 Z" />
    </g>
  </svg>
);

export const StraightArrowIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" version="1.1" width={size} height={size} {...props}>
    <g stroke="none" fill="currentColor">
      <path
        d="M8.55595221,-1.5261864 C8.88741773,-1.5261864 9.15621426,-1.25765205 9.15653772,-0.926186684 L9.16739175,10.3828136 L10.9946787,10.3836977 C11.2708211,10.3836977 11.4946787,10.6075553 11.4946787,10.8836977 C11.4946787,10.9607525 11.4768694,11.0367648 11.4426413,11.1058002 L8.8378495,16.3594519 C8.7642512,16.5078936 8.58425218,16.5685662 8.43581043,16.4949679 C8.37895485,16.4667786 8.33250284,16.4212859 8.30313336,16.3650308 L5.56226325,11.1150985 C5.43446412,10.8703088 5.52930372,10.5682659 5.77409341,10.4404667 C5.84552557,10.4031736 5.92491301,10.3836977 6.0054942,10.3836977 L7.96739175,10.3828136 L7.95653772,-0.926186684 C7.95621467,-1.25723416 8.22431979,-1.52586306 8.55536727,-1.52618611 Z"
        transform="translate(8.500035, 7.500035) rotate(-135.000000) translate(-8.500035, -7.500035) "
      />
    </g>
  </svg>
);

export const ElbowArrowIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" version="1.1" width={size} height={size} {...props}>
    <g stroke="none" fill="currentColor">
      <path d="M10.0153197,2.75391207 C10.0923746,2.75391207 10.1683869,2.77172133 10.2374222,2.80594949 L15.4910739,5.41074126 C15.6395156,5.48433956 15.7001882,5.66433859 15.6265899,5.81278033 C15.5984006,5.86963592 15.5529079,5.91608792 15.4966529,5.9454574 L10.2467205,8.68632752 C10.0019308,8.81412664 9.69988791,8.71928704 9.57208878,8.47449735 C9.53479568,8.40306519 9.51531974,8.32367776 9.51531974,8.24309656 L9.51458753,6.62591207 L6.16858753,6.62651279 L6.16914066,12.0061269 C6.16914066,12.3043606 5.95155104,12.5517736 5.66646377,12.5982739 L5.56914066,12.6061269 L0.534587532,12.6061269 C0.203216682,12.6061269 -0.0654124678,12.3374977 -0.0654124678,12.0061269 C-0.0654124678,11.674756 0.203216682,11.4061269 0.534587532,11.4061269 L4.96858753,11.4055128 L4.96914066,6.02651279 C4.96914066,5.72827903 5.18673027,5.48086604 5.47181754,5.43436578 L5.56914066,5.42651279 L9.51458753,5.42591207 L9.51531974,3.25391207 C9.51531974,2.9777697 9.73917736,2.75391207 10.0153197,2.75391207 Z" />
    </g>
  </svg>
);

export const CurveArrowIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" version="1.1" width={size} height={size} {...props}>
    <g stroke="none" fill="currentColor">
      <path d="M10.0153197,2.75391207 C10.0923746,2.75391207 10.1683869,2.77172133 10.2374222,2.80594949 L15.4910739,5.41074126 C15.6395156,5.48433956 15.7001882,5.66433859 15.6265899,5.81278033 C15.5984006,5.86963592 15.5529079,5.91608792 15.4966529,5.9454574 L10.2467205,8.68632752 C10.0019308,8.81412664 9.69988791,8.71928704 9.57208878,8.47449735 C9.53479568,8.40306519 9.51531974,8.32367776 9.51531974,8.24309656 L9.51423005,6.39035523 C5.97984781,6.85936966 3.21691607,9.08498364 1.18879108,13.1285821 C1.04022695,13.4247836 0.679673152,13.5444674 0.383471635,13.3959033 C0.0872701176,13.2473391 -0.0324136308,12.8867853 0.116150501,12.5905838 C2.34388813,8.14900524 5.48945543,5.65776043 9.51468497,5.18078677 L9.51531974,3.25391207 C9.51531974,2.9777697 9.73917736,2.75391207 10.0153197,2.75391207 Z" />
    </g>
  </svg>
);

export const MenuIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width={size}
    height={size}
    {...props}
  >
    <g strokeWidth="1.5">
      <path stroke="none" d="M0 0h24v24H0z"></path>
      <line x1="4" y1="6" x2="20" y2="6"></line>
      <line x1="4" y1="12" x2="20" y2="12"></line>
      <line x1="4" y1="18" x2="20" y2="18"></line>
    </g>
  </svg>
);

// AI 图片图标
export const AIImageIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <rect width="18" height="18" x="3" y="3" rx="3" ry="3" stroke="#E91E63" />
    <circle cx="8.5" cy="8.5" r="1.5" stroke="#E91E63" />
     <path d="m21 15-5-5a2 2 0 0 0-3 0l-9 10" stroke="#E91E63" />
  </svg>
);

// AI 视频图标
export const AIVideoIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" stroke="#FF9800" />
    <rect x="2" y="6" width="14" height="12" rx="3" stroke="#FF9800" />
  </svg>
);

export const ExportImageIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    {...props}
  >
    <g
      strokeWidth="1.25"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path stroke="none" d="M0 0h24v24H0z"></path>
      <path d="M15 8h.01"></path>
      <path d="M12 20h-5a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v5"></path>
      <path d="M4 15l4 -4c.928 -.893 2.072 -.893 3 0l4 4"></path>
      <path d="M14 14l1 -1c.617 -.593 1.328 -.793 2.009 -.598"></path>
      <path d="M19 16v6"></path>
      <path d="M22 19l-3 3l-3 -3"></path>
    </g>
  </svg>
);

export const ZoomOutIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    {...props}
  >
    <g id="zoom-out" stroke="none" fill="currentColor" strokeWidth="1">
      <path
        fillRule="nonzero"
        d="M6.85,2.73225886e-13 C10.6331505,2.73225886e-13 13.7,3.06684946 13.7,6.85 C13.7,8.54194045 13.0865836,10.0906098 12.0700142,11.2857448 L15.4201976,14.5717081 C15.6567367,14.8037768 15.6603607,15.1836585 15.4282919,15.4201976 C15.1962232,15.6567367 14.8163415,15.6603607 14.5798024,15.4282919 L14.5798024,15.4282919 L11.2163456,12.128262 C10.0309427,13.1099691 8.50937591,13.7 6.85,13.7 C3.06684946,13.7 4.58522109e-14,10.6331505 4.58522109e-14,6.85 C4.58522109e-14,3.06684946 3.06684946,2.73225886e-13 6.85,2.73225886e-13 Z M6.85,1.2 C3.72959116,1.2 1.2,3.72959116 1.2,6.85 C1.2,9.97040884 3.72959116,12.5 6.85,12.5 C8.31753357,12.5 9.65438791,11.9404957 10.6588859,11.0231643 C10.6855412,10.9625408 10.7245275,10.9050898 10.7743982,10.8542584 C10.8288931,10.7987137 10.8915387,10.7560124 10.9585649,10.7261903 C11.9144009,9.71595758 12.5,8.35136579 12.5,6.85 C12.5,3.72959116 9.97040884,1.2 6.85,1.2 Z M4.6,6.2 L9.12944565,6.2 C9.4608165,6.2 9.72944565,6.46862915 9.72944565,6.8 C9.72944565,7.09823376 9.51185604,7.34564675 9.22676876,7.39214701 L9.12944565,7.4 L4.6,7.4 C4.26862915,7.4 4,7.13137085 4,6.8 C4,6.50176624 4.21758961,6.25435325 4.50267688,6.20785299 L4.6,6.2 L9.12944565,6.2 Z"
      ></path>
    </g>
  </svg>
);

export const ZoomInIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg
    viewBox="0 0 16 16"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    {...props}
  >
    <g id="zoom-in" stroke="none" fill="currentColor" strokeWidth="1">
      <path
        fillRule="nonzero"
        d="M6.85,-1.81188398e-13 C10.6331505,-1.81188398e-13 13.7,3.06684946 13.7,6.85 C13.7,8.54194045 13.0865836,10.0906098 12.0700142,11.2857448 L15.4201976,14.5717081 C15.6567367,14.8037768 15.6603607,15.1836585 15.4282919,15.4201976 C15.1962232,15.6567367 14.8163415,15.6603607 14.5798024,15.4282919 L14.5798024,15.4282919 L11.2163456,12.128262 C10.0309427,13.1099691 8.50937591,13.7 6.85,13.7 C3.06684946,13.7 4.61852778e-14,10.6331505 4.61852778e-14,6.85 C4.61852778e-14,3.06684946 3.06684946,-1.81188398e-13 6.85,-1.81188398e-13 Z M6.85,1.2 C3.72959116,1.2 1.2,3.72959116 1.2,6.85 C1.2,9.97040884 3.72959116,12.5 6.85,12.5 C8.31753357,12.5 9.65438791,11.9404957 10.6588859,11.0231643 C10.6855412,10.9625408 10.7245275,10.9050898 10.7743982,10.8542584 C10.8288931,10.7987137 10.8915387,10.7560124 10.9585649,10.7261903 C11.9144009,9.71595758 12.5,8.35136579 12.5,6.85 C12.5,3.72959116 9.97040884,1.2 6.85,1.2 Z M6.86472282,3.93527718 C7.16295659,3.93527718 7.41036958,4.15286679 7.45686984,4.43795406 L7.46472282,4.53527718 L7.464,6.19927718 L9.12944565,6.2 C9.42767941,6.2 9.6750924,6.41758961 9.72159266,6.70267688 L9.72944565,6.8 C9.72944565,7.09823376 9.51185604,7.34564675 9.22676876,7.39214701 L9.12944565,7.4 L7.464,7.39927718 L7.46472282,9.06472282 C7.46472282,9.36295659 7.24713321,9.61036958 6.96204594,9.65686984 L6.86472282,9.66472282 C6.56648906,9.66472282 6.31907607,9.44713321 6.27257581,9.16204594 L6.26472282,9.06472282 L6.264,7.39927718 L4.6,7.4 C4.30176624,7.4 4.05435325,7.18241039 4.00785299,6.89732312 L4,6.8 C4,6.50176624 4.21758961,6.25435325 4.50267688,6.20785299 L4.6,6.2 L6.264,6.19927718 L6.26472282,4.53527718 C6.26472282,4.2701805 6.43664548,4.0452385 6.67507642,3.96586557 L6.76739971,3.94313016 L6.86472282,3.93527718 Z"
      ></path>
    </g>
  </svg>
);

export const SaveFileIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 18 18" version="1.1" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g id="save-file" stroke="none" fill="currentColor">
      <path
        fillRule="nonzero"
        d="M11.064 9.1l2.645 2.595.03-.029.848.849-3.523 3.323-.848-.848 1.994-1.883H7.5v-1.2h4.712l-1.996-1.958.848-.849zM9.356.3L13.7 3.71V7.9h-1.2l-.001-2.633H8.5V1.5L3.1 1.5a.4.4 0 0 0-.392.32L2.7 1.9v12a.4.4 0 0 0 .32.392l.08.008h3.418v1.2H3.1a1.6 1.6 0 0 1-1.593-1.454L1.5 13.9v-12A1.6 1.6 0 0 1 2.954.307L3.1.3h6.256zM9.7 2.095v1.973l2.51-.001L9.7 2.095z"
      ></path>
    </g>
  </svg>
);

export const OpenFileIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 18 18" version="1.1" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g id="save-file" stroke="currentColor" fill="none">
      <path
        d="m9.257 6.351.183.183H15.819c.34 0 .727.182 1.051.506.323.323.505.708.505 1.05v5.819c0 .316-.183.7-.52 1.035-.337.338-.723.522-1.037.522H4.182c-.352 0-.74-.181-1.058-.5-.318-.318-.499-.705-.499-1.057V5.182c0-.351.181-.736.5-1.054.32-.321.71-.503 1.057-.503H6.53l2.726 2.726Z"
        strokeWidth="1.25"
      />
    </g>
  </svg>
);

export const UndoIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    {...props}
  >
    <g stroke="none" fill="currentColor">
      <g id="undo-cion" transform="translate(1 1)">
        <path
          d="M3.84 5.825a.6.6 0 0 1 .063.774l-.064.075a.6.6 0 0 1-.774.063l-.074-.063L.176 3.859a.6.6 0 0 1-.064-.775l.064-.074L3.01.176a.6.6 0 0 1 .912.774l-.063.074-1.795 1.794h6.851a5.1 5.1 0 0 1 .216 10.196l-.216.004h-4a.6.6 0 0 1-.097-1.192l.097-.008h4a3.9 3.9 0 0 0 .201-7.795l-.2-.005H2.033l1.805 1.807z"
          id="undo-icon-path"
        ></path>
      </g>
    </g>
  </svg>
);

export const RedoIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    {...props}
  >
    <g stroke="none" fill="currentColor">
      <g id="redo-cion" transform="matrix(-1 0 0 1 15.015 1)">
        <path
          d="M3.84 5.825a.6.6 0 0 1 .063.774l-.064.075a.6.6 0 0 1-.774.063l-.074-.063L.176 3.859a.6.6 0 0 1-.064-.775l.064-.074L3.01.176a.6.6 0 0 1 .912.774l-.063.074-1.795 1.794h6.851a5.1 5.1 0 0 1 .216 10.196l-.216.004h-4a.6.6 0 0 1-.097-1.192l.097-.008h4a3.9 3.9 0 0 0 .201-7.795l-.2-.005H2.033l1.805 1.807z"
          id="redo-icon-path"
        ></path>
      </g>
    </g>
  </svg>
);

export const TrashIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" width={size} height={size} {...props}>
    <path
      strokeWidth="1.25"
      d="M3.333 5.833h13.334M8.333 9.167v5M11.667 9.167v5M4.167 5.833l.833 10c0 .92.746 1.667 1.667 1.667h6.666c.92 0 1.667-.746 1.667-1.667l.833-10M7.5 5.833v-2.5c0-.46.373-.833.833-.833h3.334c.46 0 .833.373.833.833v2.5"
    ></path>
  </svg>
);

export const FeltTipPenIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    <path d="m13.4 2 6.6 6.6-13 13L2 22l.4-5z" />
    <path d="m11 4 7 7" />
  </svg>
);

export const MaskBrushIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 2" />
    <path d="m14.5 7.5 2 2-6.4 6.4-2.6.6.6-2.6z" />
    <path d="m13.2 8.8 2 2" />
  </svg>
);

// 激光笔图标
export const LaserPointerIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    <g transform="rotate(90 10 10)">
      <path clipRule="evenodd" d="m9.644 13.69 7.774-7.773a2.357 2.357 0 0 0-3.334-3.334l-7.773 7.774L8 12l1.643 1.69Z" />
      <path d="m13.25 3.417 3.333 3.333M10 10l2-2M5 15l3-3M2.156 17.894l1-1M5.453 19.029l-.144-1.407M2.377 11.887l.866 1.118M8.354 17.273l-1.194-.758M.953 14.652l1.408.13" />
    </g>
  </svg>
);

// 钢笔工具图标（矢量路径绘制）
export const VectorPenIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    <path d="m12 19 7-7 3 3-7 7-3-3z" />
    <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="m2 2 5 5" />
    <path d="m8.5 8.5 1 1" />
  </svg>
);

export const ImageUploadIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
    <line x1="16" y1="5" x2="22" y2="5" />
    <line x1="19" y1="2" x2="19" y2="8" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

export const MermaidLogoIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

export const MarkdownLogoIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="M7 15V9l3 3 3-3v6M17 15l2-2-2-2M19 13h-4" />
  </svg>
);

export const SettingsIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width={size} height={size} {...props}>
    <g strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
    </g>
  </svg>
);

// 素材库图标 - 宫格 + 圆圈风格
export const MediaLibraryIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <circle cx="17" cy="7" r="4" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
);

export const ThemeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    width={size}
    height={size}
    {...props}
  >
    <g strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 20"/>
      <path d="M12 2c-2.5 2.5-4 6-4 10s1.5 7.5 4 10"/>
    </g>
  </svg>
);

export const WeComIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    <path d="M8 12h.01" />
    <path d="M12 12h.01" />
    <path d="M16 12h.01" />
  </svg>
);

export const MoreIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    width={size}
    height={size}
    {...props}
  >
    <g strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <circle cx="12" cy="5" r="1" fill="currentColor"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </g>
  </svg>
);

// 备份恢复图标
export const BackupRestoreIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" width={size} height={size} {...props}>
    <g strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
      <path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </g>
  </svg>
);

// 聊天图标
export const MessageIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.38 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.38 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

// 批量/多选图标
export const BatchIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <rect x="2" y="2" width="8" height="8" rx="2" />
    <rect x="14" y="2" width="8" height="8" rx="2" />
    <rect x="2" y="14" width="8" height="8" rx="2" />
    <rect x="14" y="14" width="8" height="8" rx="2" />
  </svg>
);

// 调试日志图标 - 控制台/终端风格
export const DebugLogIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    {/* 终端窗口外框 */}
    <rect x="2" y="3" width="20" height="18" rx="2" />
    {/* 顶部栏 */}
    <line x1="2" y1="7" x2="22" y2="7" />
    {/* 顶部三个点 */}
    <circle cx="5.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
    {/* 终端提示符和代码行 */}
    <path d="M5 11l2 2-2 2" />
    <line x1="9" y1="15" x2="14" y2="15" />
    <line x1="9" y1="18" x2="18" y2="18" opacity="0.5" />
  </svg>
);

export const CommandPaletteIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    {/* ⌘ Command symbol */}
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
  </svg>
);

export const BookOpenIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

type LucideStartupIconProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
};

const LucideStartupIcon: React.FC<LucideStartupIconProps> = ({
  size = 24,
  children,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    {children}
  </svg>
);

const createLucideStartupIcon = (
  children: React.ReactNode
): React.FC<LucideStartupIconProps> =>
  (props) => <LucideStartupIcon {...props}>{children}</LucideStartupIcon>;

export const ImagesIcon = createLucideStartupIcon(
  <>
    <path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16" />
    <path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" />
    <circle cx="13" cy="7" r="1" fill="currentColor" />
    <rect x="8" y="2" width="14" height="14" rx="2" />
  </>
);

export const ClapperboardIcon = createLucideStartupIcon(
  <>
    <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
    <path d="m6.2 5.3 3.1 3.9" />
    <path d="m12.4 3.4 3.1 4" />
    <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </>
);

export const FilmIcon = createLucideStartupIcon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M7 3v18" />
    <path d="M3 7.5h4" />
    <path d="M3 12h18" />
    <path d="M3 16.5h4" />
    <path d="M17 3v18" />
    <path d="M17 7.5h4" />
    <path d="M17 16.5h4" />
  </>
);

export const DiscAlbumIcon = createLucideStartupIcon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 12h.01" />
  </>
);

export const HistoryIcon = createLucideStartupIcon(
  <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </>
);

export const Music4Icon = createLucideStartupIcon(
  <>
    <path d="M9 18V5l12-2v13" />
    <path d="m9 9 12-2" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </>
);

export const PauseIcon = createLucideStartupIcon(
  <>
    <rect x="14" y="3" width="5" height="18" rx="1" />
    <rect x="5" y="3" width="5" height="18" rx="1" />
  </>
);

export const PlayIcon = createLucideStartupIcon(
  <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
);

export const EyeOffIcon = createLucideStartupIcon(
  <>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </>
);

export const RotateCcwIcon = createLucideStartupIcon(
  <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </>
);

export const Trash2Icon = createLucideStartupIcon(
  <>
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>
);

export const ChevronUpIcon = createLucideStartupIcon(
  <path d="m18 15-6-6-6 6" />
);

export const ChevronDownIcon = createLucideStartupIcon(
  <path d="m6 9 6 6 6-6" />
);

// 云端同步图标
export const CloudIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 18, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

// 清除失效链接图标 - 断开的链接 + 删除标记
export const CleanBrokenLinksIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 18, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    {/* 断开的链接 - 左半部分 */}
    <path d="M9 17H7A5 5 0 0 1 7 7" />
    <path d="M7 12h4" />
    {/* 断开的链接 - 右半部分 */}
    <path d="M15 7h2a5 5 0 0 1 4 8" />
    <path d="M13 12h4" />
    {/* 删除标记 */}
    <circle cx="18" cy="18" r="4" fill="#ff4d4f" stroke="#ff4d4f" />
    <path d="M16 18h4" stroke="white" strokeWidth="2" />
  </svg>
);

// 套索选择图标
export const LassoIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 4C7.58 4 4 6.69 4 10c0 2.05 1.3 3.86 3.3 5.04" />
    <path d="M20 10c0-3.31-3.58-6-8-6" strokeDasharray="3 2" />
    <circle cx="12" cy="14" r="3" />
    <path d="M12 17v4" />
    <path d="M10 21h4" />
  </svg>
);
