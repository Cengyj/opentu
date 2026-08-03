import React from 'react';


export const createIcon = (svg: React.ReactNode) => {
  return svg;
};

export const BackgroundColorIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="background-color-icon"
    width={size}
    height={size}
    {...props}
  >
    <g transform="translate(1 1)" fillRule="evenodd" fill="#000" stroke="none">
      <circle fillOpacity=".04" r="11" cy="11" cx="11"></circle>
      <path
        d="M17 20.221V17h3.221A11.06 11.06 0 0 1 17 20.221zm-12 0A11.06 11.06 0 0 1 1.779 17H5v3.221zM20.221 5H17V1.779A11.06 11.06 0 0 1 20.221 5zM9 .181V1H6.411A10.919 10.919 0 0 1 9 .181zM15.589 1H13V.181c.907.167 1.775.445 2.589.819zM13 21.819V21h2.589c-.814.374-1.682.652-2.589.819zm-4 0A10.919 10.919 0 0 1 6.411 21H9v.819zm-8-6.23A10.919 10.919 0 0 1 .181 13H1v2.589zm0-9.178V9H.181C.348 8.093.626 7.225 1 6.411zM21.819 9H21V6.411c.374.814.652 1.682.819 2.589zM21 15.589V13h.819A10.919 10.919 0 0 1 21 15.589zM5 1.779V5H1.779A11.06 11.06 0 0 1 5 1.779zM5 13h4v4H5v-4zm8 0h4v4h-4v-4zM5 5h4v4H5V5zm8 0h4v4h-4V5zm0 12v4H9v-4h4zm8-8v4h-4V9h4zm-8 0v4H9V9h4zM5 9v4H1V9h4zm8-8v4H9V1h4z"
        fillOpacity=".12"
      ></path>
    </g>
  </svg>
);

export const NoColorIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 32, ...props }) => (
  <svg viewBox="0 0 32 32" className="no-color-icon" width={size} height={size} {...props}>
    <g
      xmlns="http://www.w3.org/2000/svg"
      fillRule="nonzero"
      fill="currentColor"
      stroke="none"
    >
      <path d="M2 16c0 7.733 6.267 14 14 14s14-6.267 14-14S23.733 2 16 2 2 8.267 2 16zm-1 0C1 7.716 7.714 1 16 1c8.284 0 15 6.714 15 15 0 8.284-6.714 15-15 15-8.284 0-15-6.714-15-15z"></path>
      <path d="M6.354 26.354l-.708-.708 20-20 .708.708z"></path>
    </g>
  </svg>
);

export const Check: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    className="selected-icon"
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
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export const StrokeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" className="stroke-icon" width={size} height={size} {...props}>
    <g
      xmlns="http://www.w3.org/2000/svg"
      stroke="none"
      fillRule="evenodd"
      fill="#000"
    >
      <path
        d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0-4c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1z"
        fillRule="nonzero"
        fillOpacity=".04"
      ></path>
      <path
        d="M12 5V1c1.491 0 2.914.297 4.21.835L14.68 5.53A6.979 6.979 0 0 0 12 5zm4.95 2.048l2.828-2.828a11.016 11.016 0 0 1 2.388 3.568l-3.697 1.53a7.01 7.01 0 0 0-1.519-2.27zM19 12h4c0 1.491-.297 2.914-.835 4.21l-3.696-1.53c.342-.826.531-1.73.531-2.68zm-2.05 4.95l2.828 2.828a11.016 11.016 0 0 1-3.567 2.387l-1.532-3.696a7.01 7.01 0 0 0 2.27-1.52zM12 19v4c-1.491 0-2.914-.297-4.21-.835l1.53-3.696c.826.342 1.73.531 2.68.531zm-4.95-2.05l-2.828 2.828a11.016 11.016 0 0 1-2.387-3.567l3.696-1.532a7.01 7.01 0 0 0 1.52 2.27zM5 12H1c0-1.491.297-2.914.835-4.21L5.53 9.32A6.979 6.979 0 0 0 5 12zm2.05-4.95L4.222 4.222a11.016 11.016 0 0 1 3.567-2.387L9.321 5.53a7.01 7.01 0 0 0-2.27 1.52z"
        fillOpacity=".12"
      ></path>
    </g>
  </svg>
);

export const StrokeWhiteIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...props}>
    <g
      xmlns="http://www.w3.org/2000/svg"
      id="icon-border-white"
      stroke="none"
      strokeWidth="1"
      fill="none"
      fillRule="evenodd"
      opacity="0.1"
    >
      <g id="Group">
        <path
          d="M12,22 C17.5228475,22 22,17.5228475 22,12 C22,6.4771525 17.5228475,2 12,2 C6.4771525,2 2,6.4771525 2,12 C2,17.5228475 6.4771525,22 12,22 Z M12,23 C5.92486775,23 1,18.0751322 1,12 C1,5.92486775 5.92486775,1 12,1 C18.0751322,1 23,5.92486775 23,12 C23,18.0751322 18.0751322,23 12,23 Z"
          fill="#000000"
          fillRule="nonzero"
        />
        <path
          d="M12,19 C15.8659932,19 19,15.8659932 19,12 C19,8.13400675 15.8659932,5 12,5 C8.13400675,5 5,8.13400675 5,12 C5,15.8659932 8.13400675,19 12,19 Z M12,20 C7.581722,20 4,16.418278 4,12 C4,7.581722 7.581722,4 12,4 C16.418278,4 20,7.581722 20,12 C20,16.418278 16.418278,20 12,20 Z"
          fill="#000000"
          fillRule="nonzero"
        />
      </g>
    </g>
  </svg>
);

export const StrokeStyleNormalIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g transform="translate(0 14)" fillRule="evenodd" fill="none">
      <path d="M-18-19h60v40h-60z"></path>
      <path d="M0 0h24v2H0z" fill="currentColor"></path>
    </g>
  </svg>
);

export const StrokeStyleDashedIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g transform="translate(0 14)" fillRule="evenodd" fill="none">
      <g fill="currentColor">
        <path d="M0 0h6v2H0zM9 0h6v2H9zM18 0h6v2h-6z"></path>
      </g>
    </g>
  </svg>
);

export const StrokeStyleDotedIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g transform="translate(0 14)" fillRule="evenodd" fill="none">
      <g fill="currentColor">
        <rect rx="1" height="2" width="2"></rect>
        <rect rx="1" x="4" height="2" width="2"></rect>
        <rect rx="1" x="8" height="2" width="2"></rect>
        <rect rx="1" x="12" height="2" width="2"></rect>
        <rect rx="1" x="16" height="2" width="2"></rect>
        <rect rx="1" x="20" height="2" width="2"></rect>
      </g>
    </g>
  </svg>
);

export const StrokeStyleDoubleIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g transform="translate(0 12)" fillRule="evenodd" fill="none">
      <path d="M0 0h24v2H0z" fill="currentColor"></path>
      <path d="M0 4h24v2H0z" fill="currentColor"></path>
    </g>
  </svg>
);

export const FontColorIcon: React.FC<{ currentColor?: string }> = ({
  currentColor,
}) => {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className="font-color-icon"
    >
      <g
        id="font-color"
        strokeWidth="1"
        fillRule="evenodd"
        stroke="none"
        fill="currentColor"
      >
        <path
          id="secondary-color"
          d="M1.999 15.011h11.998V13.81H1.999z"
          fill={currentColor || '#333333'}
        ></path>
        <path
          d="M6.034 7.59h4.104L8.086 2.297 6.034 7.59zm-.465 1.2l-1.437 3.707H2.845L7.301 1h1.287l-.001.004h.286l4.454 11.492h-1.288L10.603 8.79H5.569z"
          id="A"
        ></path>
      </g>
    </svg>
  );
};

export const DuplicateIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 20, ...props }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    {...props}
  >
    <g strokeWidth="1.25">
      <path d="M14.375 6.458H8.958a2.5 2.5 0 0 0-2.5 2.5v5.417a2.5 2.5 0 0 0 2.5 2.5h5.417a2.5 2.5 0 0 0 2.5-2.5V8.958a2.5 2.5 0 0 0-2.5-2.5Z"></path>
      <path d="M11.667 3.125c.517 0 .986.21 1.325.55.34.338.55.807.55 1.325v1.458H8.333c-.485 0-.927.185-1.26.487-.343.312-.57.75-.609 1.24l-.005 5.357H5a1.87 1.87 0 0 1-1.326-.55 1.87 1.87 0 0 1-.549-1.325V5c0-.518.21-.987.55-1.326.338-.34.807-.549 1.325-.549h6.667Z"></path>
    </g>
  </svg>
);

// 角点锚点图标 - 控制柄可独立调整
export const AnchorCornerIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* 左侧控制柄线 */}
      <line x1="4" y1="18" x2="12" y2="12" strokeDasharray="2,2" />
      {/* 右侧控制柄线 - 角度不同 */}
      <line x1="12" y1="12" x2="20" y2="8" strokeDasharray="2,2" />
      {/* 左侧控制点 */}
      <circle cx="4" cy="18" r="2" fill="currentColor" />
      {/* 右侧控制点 */}
      <circle cx="20" cy="8" r="2" fill="currentColor" />
      {/* 中心锚点 - 方形表示角点 */}
      <rect x="9.5" y="9.5" width="5" height="5" fill="white" stroke="currentColor" strokeWidth="1.5" />
    </g>
  </svg>
);

// 平滑锚点图标 - 控制柄方向对称但长度可不同
export const AnchorSmoothIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* 左侧控制柄线 - 较短 */}
      <line x1="6" y1="16" x2="12" y2="12" strokeDasharray="2,2" />
      {/* 右侧控制柄线 - 较长，方向对称 */}
      <line x1="12" y1="12" x2="20" y2="6" strokeDasharray="2,2" />
      {/* 左侧控制点 */}
      <circle cx="6" cy="16" r="2" fill="currentColor" />
      {/* 右侧控制点 */}
      <circle cx="20" cy="6" r="2" fill="currentColor" />
      {/* 中心锚点 - 圆形表示平滑 */}
      <circle cx="12" cy="12" r="3" fill="white" stroke="currentColor" strokeWidth="1.5" />
    </g>
  </svg>
);

// 对称锚点图标 - 控制柄完全对称
export const AnchorSymmetricIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* 左侧控制柄线 */}
      <line x1="4" y1="16" x2="12" y2="12" strokeDasharray="2,2" />
      {/* 右侧控制柄线 - 完全对称 */}
      <line x1="12" y1="12" x2="20" y2="8" strokeDasharray="2,2" />
      {/* 左侧控制点 */}
      <circle cx="4" cy="16" r="2" fill="currentColor" />
      {/* 右侧控制点 */}
      <circle cx="20" cy="8" r="2" fill="currentColor" />
      {/* 中心锚点 - 菱形表示对称 */}
      <rect x="9" y="9" width="6" height="6" fill="white" stroke="currentColor" strokeWidth="1.5" transform="rotate(45 12 12)" />
    </g>
  </svg>
);

export const ImageIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

export const LinkIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width={size} height={size} {...props}>
    <g stroke="none" fill="currentColor">
      <path
        d="M12.253 4.13h-1.2v-1a2.8 2.8 0 0 0-5.6 0v4a2.8 2.8 0 0 0 2.8 2.8v1.2a4 4 0 0 1-4-4v-4a4 4 0 0 1 8 0v1zm-8 8h1.2v1a2.8 2.8 0 0 0 5.6 0v-4a2.8 2.8 0 0 0-2.8-2.8v-1.2a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-1z"
        transform="rotate(46 8.253 8.13)"
      ></path>
    </g>
  </svg>
);

export const VideoFrameIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g id="video-frame" stroke="none" fill="currentColor">
      <rect x="1" y="3" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="3" y="5" width="10" height="6" rx="0.5" fill="currentColor" opacity="0.6"/>
      <circle cx="12" cy="6" r="0.8" fill="currentColor"/>
      <path d="M2 14L5 11L7 13L11 9L14 12" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="1" y="14.5" width="14" height="1" rx="0.5" fill="currentColor"/>
      <circle cx="4" cy="15" r="0.8" fill="white" stroke="currentColor" strokeWidth="0.5"/>
    </g>
  </svg>
);

export const ViewIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width={size} height={size} {...props}>
    <g strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </g>
  </svg>
);

export const SplitImageIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none" width={size} height={size} {...props}>
    {/* 外框 */}
    <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    {/* 垂直分割线 */}
    <line x1="5.5" y1="1" x2="5.5" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2,1"/>
    <line x1="10.5" y1="1" x2="10.5" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2,1"/>
    {/* 水平分割线 */}
    <line x1="1" y1="5.5" x2="15" y2="5.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2,1"/>
    <line x1="1" y1="10.5" x2="15" y2="10.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2,1"/>
    {/* 分散箭头表示拆开 */}
    <path d="M3 3L2 2M13 3L14 2M3 13L2 14M13 13L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      {/* 向下箭头 */}
      <path d="M10 3.333v9.167" />
      <path d="M6.667 9.167L10 12.5l3.333-3.333" />
      {/* 底部托盘 */}
      <path d="M3.333 12.5v2.5c0 .92.747 1.667 1.667 1.667h10c.92 0 1.667-.747 1.667-1.667v-2.5" />
    </g>
  </svg>
);

export const MergeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      {/* 左上角小框 */}
      <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
      {/* 右上角小框 */}
      <rect x="12.5" y="2.5" width="5" height="5" rx="1" />
      {/* 左下角小框 */}
      <rect x="2.5" y="12.5" width="5" height="5" rx="1" />
      {/* 中心合并目标框 */}
      <rect x="9" y="9" width="8" height="8" rx="1.5" strokeWidth="1.5" />
      {/* 合并箭头 */}
      <path d="M7.5 5L9 6.5" />
      <path d="M12.5 5L11 6.5" />
      <path d="M5 7.5L6.5 9" />
    </g>
  </svg>
);

export const VideoMergeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      {/* 左侧视频片段 */}
      <rect x="1.5" y="5" width="5" height="4" rx="0.5" />
      <path d="M5.5 6.5L7 7L5.5 7.5" fill="currentColor" stroke="none" />
      {/* 右侧视频片段 */}
      <rect x="1.5" y="11" width="5" height="4" rx="0.5" />
      <path d="M5.5 12.5L7 13L5.5 13.5" fill="currentColor" stroke="none" />
      {/* 合并箭头 */}
      <path d="M8 7L10 10L8 13" />
      {/* 合成后的视频 */}
      <rect x="11" y="4" width="7.5" height="12" rx="1" strokeWidth="1.5" />
      {/* 播放按钮 */}
      <path d="M13.5 10L16.5 10" strokeWidth="1.5" />
      <path d="M15 8.5L15 11.5" strokeWidth="1.5" />
    </g>
  </svg>
);

// 图片编辑图标（裁剪+滤镜）
export const ImageEditIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      {/* 图片边框 */}
      <rect x="2" y="4" width="12" height="12" rx="1.5" />
      {/* 裁剪角标记 */}
      <path d="M5 4V2" />
      <path d="M2 7H4" />
      <path d="M11 16V18" />
      <path d="M14 13H16" />
      {/* 铅笔/编辑 */}
      <path d="M14.5 3.5L17.5 6.5" />
      <path d="M16 5L18 3L15.5 0.5L13.5 2.5L16 5Z" fill="currentColor" stroke="none" transform="translate(-2, 4)" />
      <path d="M11.5 7L15.5 11L10 12L11 10.5L11.5 7Z" />
    </g>
  </svg>
);

// ============ 文本特效图标 ============

// 字体选择图标
export const FontFamilyIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12.5L8 3L13 12.5" />
      <path d="M4.5 10H11.5" />
      <path d="M2 14.5H6" />
      <path d="M10 14.5H14" />
    </g>
  </svg>
);

// 阴影效果图标
export const ShadowEffectIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" fill="none" />
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" fill="none" opacity="0.4" />
    </g>
  </svg>
);

// 渐变图标
export const GradientIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="gradientIconFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#FF4500" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="12" height="12" rx="2" fill="url(#gradientIconFill)" />
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
  </svg>
);

// 图层图标
export const LayerIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L14 5.5L8 9L2 5.5L8 2Z" />
      <path d="M2 8L8 11.5L14 8" />
      <path d="M2 10.5L8 14L14 10.5" />
    </g>
  </svg>
);

// 置顶图标
export const BringToFrontIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="2" y="5" width="6" height="6" rx="1" fill="none" />
      <rect x="8" y="9" width="6" height="6" rx="1" fill="none" />
      <path d="M8 4V1M8 1L6 3M8 1L10 3" />
    </g>
  </svg>
);

// 上移一层图标
export const BringForwardIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="8" height="5" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="4" y="9" width="8" height="5" rx="1" fill="none" />
      <path d="M8 7V4M8 4L6 6M8 4L10 6" />
    </g>
  </svg>
);

// 下移一层图标
export const SendBackwardIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="8" height="5" rx="1" fill="none" />
      <rect x="4" y="9" width="8" height="5" rx="1" fill="currentColor" opacity="0.3" />
      <path d="M8 9V12M8 12L6 10M8 12L10 10" />
    </g>
  </svg>
);

// 置底图标
export const SendToBackIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="6" height="6" rx="1" fill="none" />
      <rect x="8" y="5" width="6" height="6" rx="1" fill="none" />
      <rect x="5" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <path d="M8 12V15M8 15L6 13M8 15L10 13" />
    </g>
  </svg>
);

// 属性设置图标
export const PropertySettingsIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" fill="none" />
      <circle cx="5" cy="4" r="1.5" fill="currentColor" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" />
    </g>
  </svg>
);

// 锁定/解锁图标（用于等比缩放）
export const LockIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const UnlockIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

// 提示词图标
export const PromptIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
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
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8" />
    <path d="M8 13h6" />
  </svg>
);

// 姿态/人像图标
export const PoseIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
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
    <circle cx="12" cy="7" r="4" />
    <path d="M5 22v-3a7 7 0 0 1 14 0v3" />
  </svg>
);

// 插入到画布图标 - 画框 + 中心加号
export const InsertToCanvasIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    {/* 画框 */}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* 中心加号 */}
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
);

// 对齐图标 - 主图标（带下拉箭头）
export const AlignmentIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <rect x="4" y="3" width="10" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="4" y="9" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 左对齐图标
export const AlignLeftIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <rect x="4" y="3" width="10" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="4" y="9" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 水平居中图标
export const AlignCenterIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="2" x2="8" y2="14" />
      <rect x="2" y="3" width="12" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="4" y="9" width="8" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 右对齐图标
export const AlignRightIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="14" y1="2" x2="14" y2="14" />
      <rect x="2" y="3" width="10" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="6" y="9" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 顶部对齐图标
export const AlignTopIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="14" y2="2" />
      <rect x="3" y="4" width="4" height="10" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="9" y="4" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 垂直居中图标
export const AlignMiddleIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="8" x2="14" y2="8" />
      <rect x="3" y="2" width="4" height="12" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="9" y="4" width="4" height="8" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 底部对齐图标
export const AlignBottomIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="3" y="2" width="4" height="10" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="9" y="6" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 间距分布图标 - 主图标
export const DistributeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <line x1="14" y1="2" x2="14" y2="14" />
      <rect x="5" y="4" width="6" height="8" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 水平间距图标
export const DistributeHorizontalIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <line x1="14" y1="2" x2="14" y2="14" />
      <rect x="5" y="4" width="6" height="8" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 垂直间距图标
export const DistributeVerticalIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="14" y2="2" />
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="4" y="5" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 自动排列图标
export const AutoArrangeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="9" y="2" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="2" y="9" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="9" y="9" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 布尔运算图标 - 主图标（合并）
export const BooleanIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="6" y="6" width="8" height="8" rx="1" fill="currentColor" opacity="0.2" />
    </g>
  </svg>
);

// 合并图标 (Union)
export const BooleanUnionIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-3H3a1 1 0 0 1-1-1V3z" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 减去图标 (Subtract)
export const BooleanSubtractIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="6" y="6" width="8" height="8" rx="1" fill="none" strokeDasharray="2 1" />
    </g>
  </svg>
);

// 相交图标 (Intersect)
export const BooleanIntersectIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" fill="none" />
      <rect x="6" y="6" width="8" height="8" rx="1" fill="none" />
      <rect x="6" y="6" width="4" height="4" fill="currentColor" opacity="0.3" />
    </g>
  </svg>
);

// 排除图标 (Exclude)
export const BooleanExcludeIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3h-4v4H3a1 1 0 0 1-1-1V3z" fill="currentColor" opacity="0.3" />
      <path d="M10 6v3H7a1 1 0 0 0-1 1v3h7a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-3z" fill="currentColor" opacity="0.3" />
      <rect x="2" y="2" width="8" height="8" rx="1" fill="none" />
      <rect x="6" y="6" width="8" height="8" rx="1" fill="none" />
    </g>
  </svg>
);

// 扁平化图标 (Flatten)
export const BooleanFlattenIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <g strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4M8 10v4M2 8h4M10 8h4" />
      <path d="M5 5l2 2M9 9l2 2M5 11l2-2M9 5l2 2" opacity="0.5" />
    </g>
  </svg>
);

// Frame 容器图标
export const FrameContainerIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size} {...props}>
    <rect x="1.5" y="3.5" width="13" height="11" rx="1" strokeWidth="1.2" strokeDasharray="3 2" />
    <text x="3" y="3" fontSize="4" fill="currentColor" stroke="none" fontFamily="system-ui" fontWeight="500">F</text>
  </svg>
);
