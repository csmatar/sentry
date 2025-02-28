import {forwardRef, useImperativeHandle, useRef} from 'react';
import * as React from 'react';
import classNames from 'classnames';

import {selectText} from 'app/utils/selectText';

type Props = React.PropsWithChildren<{
  className?: string;
  style?: React.CSSProperties;
}>;

type AutoSelectHandle = {
  selectText: () => void;
};

const AutoSelectText: React.ForwardRefRenderFunction<AutoSelectHandle, Props> = (
  {children, className, ...props},
  forwardedRef
) => {
  const element = useRef<HTMLSpanElement>(null);

  // We need to expose a selectText method to parent components
  // and need an imperitive ref handle.
  useImperativeHandle(forwardedRef, () => ({
    selectText: () => handleClick(),
  }));

  function handleClick() {
    if (!element.current) {
      return;
    }
    selectText(element.current);
  }

  // use an inner span here for the selection as otherwise the selectText
  // function will create a range that includes the entire part of the
  // div (including the div itself) which causes newlines to be selected
  // in chrome.
  return (
    <div
      {...props}
      onClick={handleClick}
      className={classNames('auto-select-text', className)}
    >
      <span ref={element}>{children}</span>
    </div>
  );
};

export default forwardRef(AutoSelectText);
