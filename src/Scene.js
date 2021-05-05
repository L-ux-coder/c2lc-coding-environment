// @flow

import React from 'react';
import CharacterState from './CharacterState';
import Character from './Character';
import SceneDimensions from './SceneDimensions';
import { injectIntl } from 'react-intl';
import type {IntlShape} from 'react-intl';

import './Scene.scss';

import type {WorldName} from './types';

export type SceneProps = {
    dimensions: SceneDimensions,
    characterState: CharacterState,
    world: WorldName,
    intl: IntlShape
};

class Scene extends React.Component<SceneProps, {}> {
    drawGrid(): any {
        const grid = [];
        const rowLabels = [];
        const columnLabels = [];
        if (this.props.dimensions.getWidth() === 0 ||
            this.props.dimensions.getHeight() === 0) {
            return { grid, rowLabels, columnLabels };
        }
        let yOffset = this.props.dimensions.getMinY();
        for (let i=1; i < this.props.dimensions.getHeight() + 1; i++) {
            yOffset += 1;
            if (i < this.props.dimensions.getHeight()) {
                grid.push(<line
                    className='Scene__grid-line'
                    key={`grid-cell-row-${i}`}
                    x1={this.props.dimensions.getMinX()}
                    y1={yOffset}
                    x2={this.props.dimensions.getMaxX() + 1}
                    y2={yOffset} />);
            }
            rowLabels.push(
                <circle
                    className='Scene__row-decoration'
                    key={`grid-row-decoration-${i}`}
                    cx={-0.7}
                    cy={8.25*i - 4.125}
                    r={2}/>
            )
            rowLabels.push(
                <text
                    className='Scene__grid-label'
                    aria-hidden='true'
                    textAnchor='middle'
                    key={`grid-cell-label-${i}`}
                    dominantBaseline='middle'
                    x={-0.5}
                    // Center each gridcell with height of 8.25
                    y={8.25*i - 4.125}>
                    {i}
                </text>
            )
        }
        let xOffset = this.props.dimensions.getMinX();
        for (let i=1; i < this.props.dimensions.getWidth() + 1; i++) {
            xOffset += 1;
            if (i < this.props.dimensions.getWidth()) {
                grid.push(<line
                    className='Scene__grid-line'
                    key={`grid-cell-column-${i}`}
                    x1={xOffset}
                    y1={this.props.dimensions.getMinY()}
                    x2={xOffset}
                    y2={this.props.dimensions.getMaxY() + 1} />);
            }
            columnLabels.push(
                <circle
                    className='Scene__column-decoration'
                    key={`grid-column-decoration-${i}`}
                    cx={8.25*i - 4.125}
                    cy={0}
                    r={2}/>
            )
            columnLabels.push(
                <text
                    className='Scene__grid-label'
                    aria-hidden='true'
                    key={`grid-cell-label-${String.fromCharCode(64+i)}`}
                    textAnchor='middle'
                    x={8.25*i - 4.125}
                    y={0.5}>
                    {String.fromCharCode(64+i)}
                </text>
            )
        }
        return { grid, rowLabels, columnLabels };
    }

    drawCharacterPath() {
        return this.props.characterState.path.map((pathSegment, i) => {
            return <line
                className='Scene__path-line'
                key={`path-${i}`}
                x1={pathSegment.x1 + 0.5}
                y1={pathSegment.y1 + 0.5}
                x2={pathSegment.x2 + 0.5}
                y2={pathSegment.y2 + 0.5} />
        });
    }

    getDirectionWords(direction: number): string {
        return this.props.intl.formatMessage({id: `Direction.${direction}`});
    }

    getRelativeDirection(xPos: number, yPos: number): string {
        if (this.props.dimensions.getBoundsStateY(yPos) === 'outOfBoundsBelow' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'inBounds') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.0'});
        } else if (
            this.props.dimensions.getBoundsStateY(yPos) === 'outOfBoundsBelow' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'outOfBoundsAbove') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.1'});
        } else if (
            this.props.dimensions.getBoundsStateY(yPos) === 'inBounds' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'outOfBoundsAbove') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.2'});
        } else if (
            this.props.dimensions.getBoundsStateY(yPos) === 'outOfBoundsAbove' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'outOfBoundsAbove') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.3'});
        } else if (
            this.props.dimensions.getBoundsStateY(yPos) === 'outOfBoundsAbove' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'inBounds') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.4'});
        } else if (
            this.props.dimensions.getBoundsStateY(yPos) === 'outOfBoundsAbove' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'outOfBoundsBelow') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.5'});
        } else if (
            this.props.dimensions.getBoundsStateY(yPos) === 'inBounds' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'outOfBoundsBelow') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.6'});
        } else if (
            this.props.dimensions.getBoundsStateY(yPos) === 'outOfBoundsBelow' &&
            this.props.dimensions.getBoundsStateX(xPos) === 'outOfBoundsBelow') {
            return this.props.intl.formatMessage({id: 'RelativeDirection.7'});
        } else {
            throw new Error(`Unrecognized xPos: ${xPos} or yPos: ${yPos}`);
        }
    }

    generateAriaLabel() {
        const { xPos, yPos } = this.props.characterState;
        const numColumns = this.props.dimensions.getWidth();
        const numRows = this.props.dimensions.getHeight();
        const direction = this.getDirectionWords(this.props.characterState.direction);
        if (this.props.dimensions.getBoundsStateX(xPos) !== 'inBounds'
            || this.props.dimensions.getBoundsStateY(yPos) !== 'inBounds') {
            return this.props.intl.formatMessage(
                { id: 'Scene.outOfBounds' },
                {
                    numColumns,
                    numRows,
                    direction,
                    relativeDirection: this.getRelativeDirection(xPos, yPos)
                }
            )
        } else {
            return this.props.intl.formatMessage(
                { id: 'Scene.inBounds' },
                {
                    numColumns: this.props.dimensions.getWidth(),
                    numRows: this.props.dimensions.getHeight(),
                    xPos: String.fromCharCode(64 + xPos),
                    yPos: Math.trunc(yPos),
                    direction
                }
            )
        }
    }

    handleScrollScene = (e: SyntheticEvent<HTMLDivElement>) => {
        const sceneScrollTop = e.currentTarget.scrollTop;
        const sceneScrollLeft = e.currentTarget.scrollLeft;
        const rowHeader = document.getElementById('scene-row-header');
        const columnHeader = document.getElementById('scene-column-header');
        if ((sceneScrollTop != null || sceneScrollLeft != null) && rowHeader && columnHeader) {
            rowHeader.scrollTop = sceneScrollTop;
            columnHeader.scrollLeft = sceneScrollLeft;
        }
    }

    render() {
        const minX = this.props.dimensions.getMinX();
        const minY = this.props.dimensions.getMinY();
        const width = this.props.dimensions.getWidth();
        const height = this.props.dimensions.getHeight();
        const grid = this.drawGrid().grid;
        const rowLabels = this.drawGrid().rowLabels;
        const columnLabels = this.drawGrid().columnLabels;

        // The x and y positions need to be adjusted by half a cell to centre the character.
        const translatedXPos = this.props.characterState.xPos + 0.5;
        const translatedYPos = this.props.characterState.yPos + 0.5;

        // Subtract 90 degrees from the character bearing as the character
        // image is drawn upright when it is facing East
        const characterTransform = `translate(${translatedXPos} ${translatedYPos}) rotate(${this.props.characterState.getDirectionDegrees() - 90} 0 0)`;

        // For the background, use the same translation, but skip the rotate.
        const characterBackgroundTransform = `translate(${translatedXPos} ${translatedYPos})`;

        return (
            <React.Fragment>
                <div className='Scene__container'>
                    <div className='Scene__header-corner' />
                    <div
                        id='scene-row-header'
                        className='Scene__row-header'>
                        <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='-2 0 3 135'>
                            <rect x={-1.3} y={0} width={3} height={135} />
                            {rowLabels}

                        </svg>
                    </div>
                    <div
                        id='scene-column-header'
                        className='Scene__column-header'>
                        <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 -2 217.5 3'>
                            <rect x={0} y={-0.5} width={217.5} height={3} />
                            {columnLabels}
                        </svg>
                    </div>
                    <div
                        id='scene'
                        className='Scene'
                        role='img'
                        aria-label={this.generateAriaLabel()}
                        onScroll={this.handleScrollScene}>
                        <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox={`${minX} ${minY} ${width} ${height}`}>
                            <defs>
                                <clipPath id='Scene-clippath'>
                                    <rect x={minX} y={minY} width={width} height={height} />
                                </clipPath>
                            </defs>
                            {grid}
                            <g clipPath='url(#Scene-clippath)'>
                                {this.drawCharacterPath()}
                                <rect
                                    className="Character__icon-background"
                                    x={-0.5}
                                    y={-0.5}
                                    height={1}
                                    width={1}
                                    transform={characterBackgroundTransform}
                                />
                                <Character
                                    world={this.props.world}
                                    transform={characterTransform}
                                    width={0.9}
                                />
                            </g>
                        </svg>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default injectIntl(Scene);
