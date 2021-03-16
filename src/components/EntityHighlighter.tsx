import React, {ChangeEvent, CSSProperties, ReactNode} from 'react';
import {Entity} from './App';

type Pixels = number;

const inputBorderWidth: Pixels = 1;
const inputFontSize: Pixels = 14;
const marginNormal: Pixels = 10;

const styles: {[key: string]: CSSProperties} = {
    text: {},
    highlightText: {
        color: 'transparent',
        pointerEvents: 'none',
        padding: '0',
        whiteSpace: 'pre-wrap',
        fontFamily: 'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: inputFontSize,
    },
    zeroPos: {
        textAlign: 'left',
        position: 'absolute',
        top: inputBorderWidth,
        left: inputBorderWidth,
    },
    input: {
        fontFamily: 'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: inputFontSize,
        background: 'none',
        border: `${inputBorderWidth}px solid`,
        width: '100%',
        resize: 'none',
    },
};

const colors = [
    {name: 'blue', bg: '#0074d9'},
    {name: 'navy', bg: '#001f3f'},
    {name: 'lime', bg: '#01ff70'},
    {name: 'teal', bg: '#39cccc'},
    {name: 'olive', bg: '#3d9970'},
    {name: 'fuchsia', bg: '#f012be'},
    {name: 'red', bg: '#ff4136'},
    {name: 'green', bg: '#2ecc40'},
    {name: 'orange', bg: '#ff851b'},
    {name: 'maroon', bg: '#85144b'},
    {name: 'purple', bg: '#b10dc9'},
    {name: 'yellow', bg: '#ffdc00'},
    {name: 'aqua', bg: '#7fdbff'},
];

const eventsToWatch = ['select', 'click', 'keyup'];

class TextNode {
    constructor(public text: string, public color?: string) {}
}

class Range {
    constructor(public start: number, public end: number) {}
}

function hashString(str: string): number {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i += 1) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash &= hash; // Convert to 32bit integer
    }
    return hash > 0 ? hash : -hash;
}

function entityIsInsideRange(entity: Entity, range: Range): boolean {
    return (
        (entity.start >= range.start && entity.end < range.end) ||
        (entity.start > range.start && entity.end <= range.end)
    );
}

function entityOverlapsWithRange(entity: Entity, range: Range): boolean {
    return (
        (entity.start < range.start && entity.end > range.start && entity.end <= range.end) ||
        (entity.start >= range.start && entity.start < range.end && entity.end > range.end)
    );
}

function entityIsBeforeRange(entity: Entity, range: Range): boolean {
    return entity.start < range.start && entity.end <= range.start;
}

function entityIsBeyondRange(entity: Entity, range: Range): boolean {
    return entity.start >= range.end && entity.start > range.start;
}

function rangeIsInsideEntity(entity: Entity, range: Range): boolean {
    return entity.start <= range.start && entity.end >= range.end;
}

// A super-dumb way to generate unique keys for React lists.
function uniqueKeyGenerator(): () => number {
    let key = 0;
    return function () {
        return key++;
    };
}

const getKey: () => number = uniqueKeyGenerator();

interface Props {
    text: string;
    entities: Entity[];
    onChange: (text: string, entities: Entity[]) => void;
}

interface State {
    entityLabelInputText: string;
    cursorPosition: number;
}

class EntityHighlighter extends React.Component<Props, State> {
    inputNode!: HTMLTextAreaElement;
    selectionStart = 0;
    selectionEnd = 0;

    state: State = {
        entityLabelInputText: '',
        cursorPosition: this.selectionStart,
    };

    selectionChangeHandler = (event: Event): void => {
        const target = event.target as HTMLTextAreaElement;

        if (target === this.inputNode) {
            this.selectionStart = target.selectionStart;
            this.selectionEnd = target.selectionEnd;

            this.setState({cursorPosition: this.selectionStart});
        }
    };

    componentDidMount() {
        eventsToWatch.forEach((eventName) => document.addEventListener(eventName, this.selectionChangeHandler, false));
        this.focusInput();
    }

    componentWillUnmount() {
        eventsToWatch.forEach((eventName) => document.removeEventListener(eventName, this.selectionChangeHandler));
    }

    // Change event is fired before the "keyup" event. For this reason "this.selectionStart" and "this.selectionEnd" are not yet
    // updated by "selectionChangeHandler" when this method is called.
    textChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
        const newText = event.target.value;
        const {entities, onChange, text: oldText} = this.props;
        const previousSelectionEnd = this.selectionEnd;
        const previousSelectionStart = this.selectionStart;
        const previousSelectionSize = previousSelectionEnd - previousSelectionStart;
        const newSelectionStart = this.inputNode.selectionStart;
        const newSelectionEnd = this.inputNode.selectionEnd;
        const textSizeDiff = newText.length - oldText.length;

        const deletedBeforeCursor =
            previousSelectionSize === 0 && textSizeDiff < 0 && newSelectionEnd < previousSelectionEnd;
        const deletedAfterCursor =
            previousSelectionSize === 0 && textSizeDiff < 0 && newSelectionEnd === previousSelectionEnd;

        // The character range (in the original text) that was updated as a result of the change event. For example if we delete
        // the first character, the range will be [0, 1].
        let originalRange: Range;

        if (deletedAfterCursor || deletedBeforeCursor) {
            originalRange = new Range(newSelectionStart, newSelectionStart - textSizeDiff);
        } else {
            // Replaced selection with something else. Typing something in is an edge case of
            // replacing (zero) selection.
            originalRange = new Range(previousSelectionStart, previousSelectionEnd);
        }

        // If we select and replace a block of text that either goes across the entity's boundary or encapsulates an
        // entity entirely, we do not have enough information to update the entity's values. We have to remove it.
        const brokenEntities = entities.filter(
            (entity) => entityOverlapsWithRange(entity, originalRange) || entityIsInsideRange(entity, originalRange)
        );

        if (brokenEntities.length > 0) {
            console.log(`Removing ${brokenEntities.length} broken entities.`);
        }

        // Entities that are not affected by the text changes.
        const unchangedEntities = entities.filter((entity) => entityIsBeforeRange(entity, originalRange));

        // Entities that had text added or removed inside them.
        const modifiedEntities = entities
            .filter((entity) => rangeIsInsideEntity(entity, originalRange))
            .map((entity) => ({...entity, end: entity.end + textSizeDiff}));

        // Entities that need to move because the text before them was changed.
        const shiftedEntities = entities
            .filter((entity) => entityIsBeyondRange(entity, originalRange))
            .map((entity) => ({...entity, start: entity.start + textSizeDiff, end: entity.end + textSizeDiff}));

        // Some entities can end up with zero content. We have to filter them out.
        const newEntities = [...unchangedEntities, ...modifiedEntities, ...shiftedEntities].filter(
            (entity) => entity.end > entity.start
        );

        onChange(newText, newEntities);
    };

    focusInput() {
        if (this.inputNode) {
            this.inputNode.focus();
        }
    }

    findEntities = (positionInText: number): Entity[] => {
        return this.props.entities.filter((e) => e.start <= positionInText && e.end > positionInText);
    };

    renderHighlights(): ReactNode {
        const {text, entities = []} = this.props;
        const textNodes: TextNode[] = this.getTextNodes(text, entities);

        // We cannot simply use array index as a key because React tries to reuse the element and applies the wrong color.
        // Should be unique key.
        return (
            <div style={{...styles.zeroPos, ...styles.highlightText}}>
                {textNodes.map((textNode: TextNode) => (
                    <span
                        key={getKey()}
                        style={{backgroundColor: textNode.color ? textNode.color : 'none', opacity: 0.3}}
                    >
                        {textNode.text}
                    </span>
                ))}
            </div>
        );
    }

    getTextNodes(text: string, entities: Entity[]): TextNode[] {
        const bounds: number[] = entities
            .map((entity) => [entity.start, entity.end])
            .flat()
            .sort((a, b) => a - b);

        // Split the text into individual chunks. Each chunk is either simple text or a part of one or
        // more entities that can overlap.
        const ranges: Range[] = this.getRanges([0, ...bounds, text.length]);

        return ranges.map((range: Range) => {
            const entitiesInRange = this.rangeBelongsToEntities(entities, range);
            return new TextNode(text.substring(range.start, range.end), this.getTextNodeColor(entitiesInRange));
        });
    }

    getTextNodeColor(entitiesInRange: Entity[]): string {
        if (entitiesInRange.length === 0) {
            return '';
        } else if (entitiesInRange.length === 1) {
            return colors[hashString(entitiesInRange[0].label) % colors.length].bg;
        } else {
            return this.mixColorsMock();
        }
    }

    // In real life this would mix multiple RGB colors to pain the overlapping entities.
    // Here it just returns green;
    mixColorsMock(): string {
        return '#00ff00';
    }

    getRanges(bounds: number[], accumulator: Range[] = []): Range[] {
        if (bounds.length === 2) {
            return [...accumulator, new Range(bounds[0], bounds[1])].filter((range) => range.end > range.start);
        }

        return this.getRanges(bounds.slice(1), [...accumulator, new Range(bounds[0], bounds[1])]);
    }

    // This can be optimized to avoid going through all (sorted) entities each time.
    rangeBelongsToEntities(entities: Entity[], range: Range): Entity[] {
        return entities.filter((entity) => rangeIsInsideEntity(entity, range));
    }

    deleteEntity = (entity: Entity): void => {
        const {entities, onChange, text} = this.props;
        const deleted = entities.findIndex(
            (e) => e.start === entity.start && e.end === entity.end && e.label === entity.label
        );
        onChange(text, [...entities.slice(0, deleted), ...entities.slice(deleted + 1)]);
    };

    addEntity = (): void => {
        const {text, entities = [], onChange} = this.props;
        const newEntity: Entity = {
            start: this.selectionStart,
            end: this.selectionEnd,
            label: this.state.entityLabelInputText,
        };
        onChange(text, [...entities, newEntity]);
    };

    nothingIsSelected(): boolean {
        return this.selectionStart === this.selectionEnd;
    }

    entityLabelChanged = (event: ChangeEvent<HTMLInputElement>): void => {
        this.setState({entityLabelInputText: event.target.value});
    };

    entityAddControlsDisabled(): boolean {
        return this.selectionStart === this.selectionEnd;
    }

    renderEntitiesUnderCursor(): ReactNode {
        const entitiesUnderCursor: Entity[] = this.findEntities(this.state.cursorPosition);
        if (entitiesUnderCursor.length > 0) {
            return (
                <div style={{marginTop: 10}}>
                    {entitiesUnderCursor.map((e, i) => (
                        <span key={i}>
                            {this.props.text.substring(e.start, e.end)} ({e.label})
                            <button
                                style={{
                                    border: '0 none',
                                    cursor: 'pointer',
                                    backgroundColor: 'transparent',
                                }}
                                onClick={() => this.deleteEntity(e)}
                            >
                                <span role="img" aria-label="Delete">
                                    🗑️
                                </span>
                            </button>
                        </span>
                    ))}
                </div>
            );
        }
    }

    storeInputNode = (node: HTMLTextAreaElement | null): void => {
        if (node) {
            this.inputNode = node;
        }
    };

    render(): ReactNode {
        const {text} = this.props;
        return (
            <div>
                <div style={{position: 'relative', marginBottom: marginNormal}}>
                    <textarea
                        style={styles.input}
                        ref={this.storeInputNode}
                        onChange={this.textChange}
                        value={text}
                        rows={10}
                    />

                    {this.renderHighlights()}
                </div>

                <div>
                    <input
                        type="text"
                        placeholder="Entity label"
                        value={this.state.entityLabelInputText}
                        onChange={this.entityLabelChanged}
                        disabled={this.entityAddControlsDisabled()}
                    />

                    <button onClick={this.addEntity} disabled={this.entityAddControlsDisabled()}>
                        Add entity for selection
                    </button>
                </div>

                {this.nothingIsSelected() && this.renderEntitiesUnderCursor()}
            </div>
        );
    }
}

export default EntityHighlighter;
