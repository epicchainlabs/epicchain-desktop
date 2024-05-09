// @flow
import React, { Component } from 'react'
import type { Node } from 'react'
import { Link } from 'react-router-dom'
import classNames from 'classnames'

import styles from './SettingsLink.scss'
import DropdownIcon from '../../../assets/icons/dropdown.svg'

type Props = {
  title: string | Node,
  to: string,
  tooltip?: boolean,
  noBorderBottom?: boolean,
  label?: string | Node,
  onClick?: Function,
  renderIcon?: Function,
}

export default class SettingsLink extends Component<Props> {
  render() {
    const { tooltip = false } = this.props
    return this.props.onClick ? (
      <div
        className={classNames(styles.settingsLink, {
          [styles.noBorderBottom]: this.props.noBorderBottom,
          [styles.defaultCursor]: tooltip,
        })}
        onClick={this.props.onClick}
      >
        {this.props.renderIcon && (
          <div className={styles.icon}>{this.props.renderIcon()} </div>
        )}
        <span className={styles.settingsLinkLabel}>{this.props.title}</span>
        <label className={styles.greenLabel}>{this.props.label}</label>
        {!tooltip && <DropdownIcon className={styles.settingsLinkIcon} />}
      </div>
    ) : (
      <Link
        className={classNames(styles.settingsLink, {
          [styles.noBorderBottom]: this.props.noBorderBottom,
          [styles.defaultCursor]: tooltip,
        })}
        to={this.props.to}
      >
        {this.props.renderIcon && (
          <div className={styles.icon}>{this.props.renderIcon()} </div>
        )}
        <span className={styles.settingsLinkLabel}>{this.props.title}</span>
        <label className={styles.greyLabel}>{this.props.label}</label>
        {!tooltip && <DropdownIcon className={styles.settingsLinkIcon} />}
      </Link>
    )
  }
}
