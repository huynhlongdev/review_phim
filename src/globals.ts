if (typeof window !== 'undefined') {
  function MPEGMode(this: any, ordinal: number) {
    var _ordinal = ordinal;
    this.ordinal = function () {
      return _ordinal;
    };
  }
  (MPEGMode as any).STEREO = new (MPEGMode as any)(0);
  (MPEGMode as any).JOINT_STEREO = new (MPEGMode as any)(1);
  (MPEGMode as any).DUAL_CHANNEL = new (MPEGMode as any)(2);
  (MPEGMode as any).MONO = new (MPEGMode as any)(3);
  (MPEGMode as any).NOT_SET = new (MPEGMode as any)(4);
  (window as any).MPEGMode = MPEGMode;
}
export {};
