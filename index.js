const el = (query, parent = null) => (parent ?? document).querySelector(query)
const els = (query, parent = null) => Array.from((parent ?? document).querySelectorAll(query) ?? [])
const on = (element, event, handler) => element.addEventListener(event, handler)
const attr = (element, attribute, value = null) => {
    attribute = attribute.trim()
    const startChar = attribute[0]
    switch (startChar) {
        case '+':
            return element.setAttribute(attribute.slice(1), value ?? '')
        case '-':
            return element.removeAttribute(attribute.slice(1))
        case '%':
            return attr(
                element,
                (element.hasAttribute(attribute.slice(1)) ? '-' : '+') + attribute.slice(1),
                value
            )
        default:
            return value !== null ? attr(element, '+' + attribute, value) : element.getAttribute(attribute)
    }
}

/**
 * @param {"pascal" | "kebab" | "camel" | "snake" | "title"} from
 * @param {"pascal" | "kebab" | "camel" | "snake" | "title"} to
 * @param {string} text
 * @returns {string}
 */
function caseConvert(from, to, text) {
    switch (true) {
        case from == "pascal" && to == "kebab":
            return text.replace(/([A-Z])/g, (_, $0) => '-' + $0.toLowerCase())
        case from == "pascal" && to == "camel":
            return text.replace(/^([A-Z])/g, (_, $0) => $0.toLowerCase())
        case from == "pascal" && to == "snake":
            return text.replace(/([A-Z])/g, (_, $0) => '_' + $0.toLowerCase())
        case from == "pascal" && to == "title":
            return text.replace(/([A-Z])/g, (_, $0) => ' ' + $0).trimStart()
        case from == "kebab" && to == "camel":
            return text.replace(/\-(\w)/g, (_, $0) => $0.toUpperCase()).replace(/^(\w)/, $0 => $0.toLowerCase())
        case from == "kebab" && to == "pascal":
            return text.replace(/\-(\w)/g, (_, $0) => $0.toUpperCase()).replace(/^(\w)/, $0 => $0.toUpperCase())
        case from == "kebab" && to == "snake":
            return text.replace(/-/g, "_")
        case from == "kebab" && to == "title":
            return text.replace(/\-(\w)/g, (_, $0) => ' ' + $0.toUpperCase()).trimStart()
        case from == "camel" && to == "kebab":
            return caseConvert("pascal", "kebab", text)
        case from == "camel" && to == "pascal":
            return text.replace(/^([a-z])/g, (_, $0) => $0.toUpperCase())
        case from == "camel" && to == "snake":
            return caseConvert("pascal", "snake", text)
        case from == "camel" && to == "title":
            return caseConvert("pascal", "title", text).replace(/^(\w)/, $0 => $0.toUpperCase())
        case from == "snake" && to == "camel":
            return text.replace(/_(\w)/g, (_, $0) => $0.toUpperCase())
        case from == "snake" && to == "pascal":
            return text.replace(/_(\w)/g, (_, $0) => $0.toUpperCase()).replace(/^(\w)/, $0 => $0.toUpperCase())
        case from == "snake" && to == "kebab":
            return text.replace(/_/g, "-")
        case from == "snake" && to == "title":
            return text.replace(/_(\w)/g, (_, $0) => ' ' + $0.toUpperCase()).trimStart()
        case from == "title" && to == "pascal":
            return text.replace(/ (\w)/g, (_, $0) => $0.toUpperCase()).replace(/^(\w)/, $0 => $0.toUpperCase())
        case from == "title" && to == "kebab":
            return text.replace(/ (\w)/g, (_, $0) => '-' + $0.toLowerCase())
        case from == "title" && to == "camel":
            return text.replace(/ (\w)/g, (_, $0) => $0.toLowerCase()).replace(/^(\w)/, $0 => $0.toLowerCase())
        case from == "title" && to == "snake":
            return text.replace(/ (\w)/g, (_, $0) => '_' + $0.toLowerCase())
        default:
            throw new TypeError(`[InternalError: Tempearly] Unknown case conversion from '${from}' to '${to}'`)
    }
}

/**
 * @template T
 */
class Signal {
    /**
     * @type {T}
     */
    #value
    /**
     * @type {Set<typeof Signal.listeners[0]>}
     */
    #subscribers = new Set()

    /**
     * @param {T} initialValue
     */
    constructor(initialValue) {
        this.#value = initialValue
    }

    get value() {
        return this.#read()
    }

    /**
     * @param {T} newValue
     */
    set value(newValue) {
        this.#write(newValue)
    }

    #read = () => {
        let listener = Signal.listeners[Signal.listeners.length - 1]
        if (listener) {
            this.#subscribers.add(listener)
        }
        return this.#value
    }

    /**
     * @param {T} newValue
     */
    #write = (newValue) => {
        this.#value = typeof newValue != "function"
            ? newValue
            : newValue(this.#value)
        this.#subscribers.forEach((subscriber) => subscriber())
    }

    *[Symbol.iterator]() {
        yield this.#read, yield this.#write
    }

    /**
     * @type {Array<() => void>}
     */
    static listeners = []
}

/**
 * @template T
 * @param {T} initialValue
 * @returns {Signal<T>}
 */
export function $signal(initialValue) {
    return new Signal(initialValue)
}

/**
 * @template T
 * @param {() => T} callback
 */
export function $computed(callback) {
    /**
     * @type {Signal<T>}
     */
    const signal = $signal()
    $effect(() => signal.value = callback())
    return signal
}

/**
 * @param {() => void} callback
 */
export function $effect(callback) {
    Signal.listeners.push(callback)
    callback()
    Signal.listeners.pop()
}

const PROPS = Symbol("PROPS")
const TEMP = Symbol("TEMP")

/**
 * @param {{
 *  [TEMP]: symbol,
 *  [PROPS]: { [x: string]: any},
 *  instance: (id: string, props: {[x: string]: any}) => void
 * }} tempObj
 * @returns {{[x: string]: any}}
 */
export function $props(tempObj) {
    if (TEMP in tempObj)
        return tempObj[PROPS]

    throw new TypeError(`[Error: Tempearly] Expected a Tempearly Object instead found '${String(tempObj)}'`)
}

export default {
    /**
     * @param {{
     *  template: string,
     *  props: {[x: string]: any},
     *  onAttach?: () => void,
     *  onDetach?: () => void<
     * }} options
     * @returns 
     */
    new(options) {
        const context = this
        options.props ??= {}

        const { template, props: templateData } = options
        if (!template.includes('-')) this._throwError(this._errors[1])

        /**
         * @type {HTMLTemplateElement}
         */
        const templateElement = el(`template#${template.trim()}`)
        if (!templateElement) this._throwError(this._errors[0], template)

        customElements.define(template, class extends HTMLElement {
            /**
             * @type {typeof options}
             */
            _options = {}
            /**
             * @type {Map<string, [string, (prop: string) => void]>}
             */
            _reactiveEvents = new Map()

            constructor() {
                super()
                this._init(options)
            }

            connectedCallback() {
                this._options.onAttach?.()
            }

            disconnectedCallback() {
                this._options.onDetach?.()
            }

            /**
             * @param {ReactiveType} eventType
             * @param {{[x: string]: any}} options
             */
            dispatchReactiveEvent(eventType, options) {
                const reactiveEvents = this._reactiveEvents.get(eventType)
                if (!reactiveEvents) return

                for (const [prop, callback] of reactiveEvents) {
                    let data = options[prop]
                    if (data === undefined) return
                    data = data instanceof Signal ? data.value : data
                    callback(data)
                }
            }

            _init(_options = options) {
                if (_options) this._options = _options
                const { props: instanceData } = this._options

                const templateContent = templateElement.content.cloneNode(true)
                const instanceElement = this

                const templateAttributes = Object
                    .keys(templateElement.dataset)
                    .filter(x => (/^[A-Z]/).test(x))

                initializeTemplateStyles(templateContent, template)
                placeInstanceChildrenInTemplateSlots(instanceElement, templateContent)

                interpolateValues(
                    context, templateElement, templateAttributes, templateContent,
                    templateData, instanceElement, instanceData
                )

                this.appendChild(templateContent)
            }
        })

        return {
            [TEMP]: /**@type {const}*/ (TEMP),
            [PROPS]: options.props,
            /**
             * @param {string} id
             * @param {{[x: string]: any}} props
             */
            instance(id, props) {
                id = id.trim()

                /**@type {HTMLElement} */
                const element = el(template + '#' + id)
                if (!element) context._throwError(context._errors[2], template, id)

                for (const prop in props) {
                    const data = props[prop]
                    const defaultData = options.props[prop]
                    if (defaultData && defaultData instanceof Signal) {
                        defaultData.value = data
                    }
                    else {
                        options.props[prop] = data
                    }
                }

                element.dispatchReactiveEvent("this-attr", props)
                element.dispatchReactiveEvent("event-attr", props)
                element.dispatchReactiveEvent("js-attr", props)
                element.dispatchReactiveEvent("html-attr", props)
                element.dispatchReactiveEvent("whence-nodes", props)
                element.dispatchReactiveEvent("when-nodes", props)
                element.dispatchReactiveEvent("each-nodes", props)
                element.dispatchReactiveEvent("text-nodes", props)
            }
        }
    },
    _errors: /**@type {const}*/ ([
        `[Error: Tempearly] The <template id="{0}"> not found.`,
        `[Error: Tempearly] Template id must be a multi-part identifier seperated by '-'. Eg: my-button, ui-list`,
        `[Error: Tempearly] Custom element <{0} id="{1}"> cannot be found`,
        `[Error: Tempearly] Invalid attribute value <{0} {1}="{2}">. Expected the value to begin with 'data--'`,
        `[Error: Tempearly] Cannot use <{0} whence> since '{1}' is not of type 'boolean'`,
    ]),
    /**
     * @param {string} error
     * @param  {...string} args
     */
    _throwError(error, ...args) {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i]
            error = error.replace(`{${i}}`, arg)
        }
        throw error
    }
}

function initializeTemplateStyles(templateContent, template) {
    let templateStyles = ''
    const templateStylesElements = els("style", templateContent)

    for (const templateStyleElement of templateStylesElements) {
        templateStyles += '\n' + templateStyleElement.textContent
        templateStyleElement.remove()
    }

    const styleElement = document.createElement("style")
    styleElement.dataset.for = template
    styleElement.textContent = templateStyles
    document.head.appendChild(styleElement)
}

/**
 * @param {HTMLTemplateElement} templateElement
 * @param {string[]} templateAttributes 
 * @param {DocumentFragment} templateContent
 * @param {{[x: string]: any}} templateData
 * @param {HTMLElement} instanceElement
 * @param {{[x: string]: any}} instanceData
 */
function interpolateValues(
    context, templateElement, templateAttributes, templateContent,
    templateData, instanceElement, instanceData
) {
    for (const templateAttr_pascalCase of templateAttributes) {
        const templateAttribute = {
            pascalCase: templateAttr_pascalCase,
            camelCase: caseConvert("pascal", "camel", templateAttr_pascalCase),
            kebabCase: caseConvert("pascal", "kebab", templateAttr_pascalCase),
        }

        const attrDefault = (instanceElement.dataset[templateAttr_pascalCase]
            ?? templateElement.dataset[templateAttr_pascalCase] ?? '').trim()

        instanceData[templateAttribute.camelCase] ??= templateData[templateAttribute.camelCase] ?? attrDefault

        const interpolationArgs = [
            context, templateElement, templateAttribute, templateContent,
            templateData, instanceElement, instanceData
        ]

        interpolateAttributes(...interpolationArgs)
        interpolateChildren(...interpolationArgs)
    }
}

/**
 * @param {HTMLElement} instanceElement
 * @param {DocumentFragment} templateContent
 */
function placeInstanceChildrenInTemplateSlots(instanceElement, templateContent) {
    const slottedChildFragment = document.createDocumentFragment()
    for (const slottedChild of [...instanceElement.childNodes]) {
        instanceElement.removeChild(slottedChild)
        slottedChildFragment.appendChild(slottedChild)
    }

    /**
     * @type {HTMLSlotElement[]}
     */
    const templateSlots = els("slot", templateContent)
    let defaultSlot = null
    
    for (const templateSlot of templateSlots) {
        const slotName = templateSlot.name
        if (!slotName) {
            defaultSlot = templateSlot
            continue
        }

        const slottedChildren = els(`[slot="${slotName}"]`, slottedChildFragment)
        for (const slottedChild of slottedChildren) {
            slottedChildFragment.removeChild(slottedChild)
            templateContent.insertBefore(slottedChild, templateSlot)
        }
        templateSlot.remove()
    }

    if (defaultSlot) {
        templateContent.insertBefore(slottedChildFragment, defaultSlot)
        defaultSlot.remove()
    }
}

/**
 * @param {HTMLTemplateElement} templateElement
 * @param {{pascalCase: string, kebabCase: string}} templateAttribute
 * @param {DocumentFragment} templateContent
 * @param {{[x: string]: any}} templateData
 * @param {HTMLElement} instanceElement
 * @param {{[x: string]: any}} instanceData
 * @param {string} templateAttribute.camelCase
 */
function interpolateAttributes(
    context, templateElement, templateAttribute, templateContent, templateData,
    instanceElement, instanceData
) {
    /**@type {HTMLElement[]} */
    let instanceChildren = els(`[data-${templateAttribute.kebabCase}]`, templateContent)

    for (const instanceChild of instanceChildren) {
        /**@type {string} */
        const instanceChildData = instanceChild
            .dataset[templateAttribute.pascalCase].trim() || templateData[templateAttribute.camelCase]

        for (const dataPoint of instanceChildData.split(',')) {
            attachAttr(dataPoint.trim(), instanceChild)
        }
    }

    /**
     * @param {string} dataPoint
     * @param {HTMLElement} instanceChild
     */
    function attachAttr(dataPoint, instanceChild) {
        switch (true) {
            case dataPoint == "this":
                return attachThisAttr(dataPoint, instanceChild)
            case dataPoint.startsWith("event."):
                return attachEventHandlerAttr(dataPoint, instanceChild)
            case dataPoint.startsWith('.'):
                return attachJSAttr(dataPoint, instanceChild)
            default:
                return attachHTMLAttr(dataPoint, instanceChild)
        }
    }

    /**
     * @param {string} dataPoint
     * @param {HTMLElement} instanceChild
     */
    function attachThisAttr(dataPoint, instanceChild) {
        executor(instanceElement, "this-attr", templateAttribute.camelCase, instanceChild)((value) => {
            if (instanceData[templateAttribute.camelCase] instanceof Signal) {
                return instanceData[templateAttribute.camelCase].value = value
            }
            instanceData[templateAttribute.camelCase] = value
        })
    }

    /**
     * @param {string} dataPoint
     * @param {HTMLElement} instanceChild
     */
    function attachEventHandlerAttr(dataPoint, instanceChild) {
        const event = dataPoint.replace("event.", '')
        executor(instanceElement, "event-attr", templateAttribute.camelCase, instanceData[templateAttribute.camelCase])((handler) =>
            on(instanceChild, event, handler)
        )
    }

    /**
     * @param {string} dataPoint
     * @param {HTMLElement} instanceChild
     */
    function attachJSAttr(dataPoint, instanceChild) {
        const jsProp = dataPoint.replace('.', '')
        executor(instanceElement, "js-attr", templateAttribute.camelCase, instanceData[templateAttribute.camelCase])((value) =>
            instanceChild[jsProp] = value
        )
    }

    /**
     * @param {string} dataPoint
     * @param {HTMLElement} instanceChild
     */
    function attachHTMLAttr(dataPoint, instanceChild) {
        executor(instanceElement, "html-attr", templateAttribute.camelCase, instanceData[templateAttribute.camelCase])((value) => {
            if (attr(instanceChild, dataPoint) !== value)
                attr(instanceChild, '+' + dataPoint, value)
        })
    }
}

/**
 * @param {HTMLTemplateElement} templateElement
 * @param {{pascalCase: string, kebabCase: string}} templateAttribute
 * @param {DocumentFragment} templateContent
 * @param {{[x: string]: any}} templateData
 * @param {HTMLElement} instanceElement
 * @param {{[x: string]: any}} instanceData
 */
function interpolateChildren(
    context, templateElement, templateAttribute, templateContent, templateData,
    instanceElement, instanceData
) {
    /**@type {HTMLElement[]} */
    let instanceChildren = els(`data-${templateAttribute.kebabCase}`, templateContent)
    const templateAttributes = Object
        .keys(templateElement.dataset)
        .filter(x => (/^[A-Z]/).test(x))

    for (let i = instanceChildren.length - 1; i >= 0; i--) {
        let eachAttrValue, whenAttrValue, whenCondition = true, isInitial = true
        const instanceChild = instanceChildren[i]
        let instanceChildParent = instanceChild.parentNode ?? instanceChild.parentElement

        const elementName = templateAttribute.kebabCase.replace(/^\-/, '')
        const prop = caseConvert("kebab", "camel", elementName)

        const instanceGrandChildren = instanceChild.childNodes
        const childIdx = [].indexOf.call(instanceChildParent.childNodes, instanceChild)

        if (instanceChild.hasAttribute("whence")) {
            let grandChildren = []
            executor(instanceElement, "whence-nodes", prop, instanceData[prop] ?? templateData[prop])(
                function (show) {

                    if (typeof show != "boolean")
                        context._throwError(context._errors[4], elementName, prop)

                    if (!isInitial && instanceChildParent instanceof DocumentFragment)
                        instanceChildParent = instanceElement

                    if (!show) {
                        for (let grandChild of grandChildren) {
                            grandChild.remove()
                        }
                        grandChildren = []
                        return
                    }

                    for (let instanceGrandChild of instanceGrandChildren) {
                        instanceGrandChild = instanceGrandChild.cloneNode(true)
                        grandChildren.push(instanceGrandChild)

                        instanceChildParent.insertBefore(
                            instanceGrandChild,
                            instanceChildParent.childNodes[childIdx] ?? null
                        )
                    }
                }
            )

            instanceChild.remove()
            isInitial = false
            continue
        }

        let negated = false, whenProp

        if (whenAttrValue = instanceChild.getAttribute("when")?.trim()) {
            if (!((/^data\-\-/).test(whenAttrValue)
                || (negated = (/^!\s*data\-\-/).test(whenAttrValue))))
                context._throwError(context._errors[3], templateAttribute.kebabCase, "when", whenAttrValue)

            const prop = caseConvert("kebab", "camel", whenAttrValue.replace(/^!?\s*data\-\-/, ''))
            whenCondition = instanceData[whenProp = prop] ?? templateData[prop] ?? false
        }

        if (eachAttrValue = instanceChild.getAttribute("each")?.trim()) {
            const KEY = Symbol("KEY")
            let keyAttrValue = instanceChild.getAttribute("key")?.trim()
            let indexAttrValue = instanceChild.getAttribute("index")?.trim()

            if (!eachAttrValue.startsWith("data--"))
                context._throwError(context._errors[3], elementName, "each", eachAttrValue)

            if (indexAttrValue && !indexAttrValue.startsWith("data--"))
                context._throwError(context._errors[3], elementName, "index", indexAttrValue)

            if (keyAttrValue && !keyAttrValue.startsWith("data--"))
                context._throwError(context._errors[3], elementName, "key", keyAttrValue)

            keyAttrValue &&= caseConvert("kebab", "camel", keyAttrValue.replace(/^data\-\-/, ''))
            const keyExtractor = instanceData[keyAttrValue]
                ?? templateData[keyAttrValue]
                ?? ((_, i) => i)

            const eachAttrProp = eachAttrValue.replace(/^data\-/, '')
            const indexAttrProp = indexAttrValue?.replace(/^data\-/, '')

            indexAttrProp &&
                templateAttributes.push(caseConvert("kebab", "pascal", indexAttrProp))
            templateAttributes.push(caseConvert("kebab", "pascal", eachAttrProp))

            let eachNodes = new Map()
            executor(instanceElement, "when-nodes", whenProp, whenCondition)(
                function (show) {
                    show = negated ? !show : show
                    executor(instanceElement, "each-nodes", prop, instanceData[prop] ?? templateData[prop] ?? [])(
                        function (values) {

                            if (!isInitial && instanceChildParent instanceof DocumentFragment)
                                instanceChildParent = instanceElement

                            if (!show) {
                                for (let [, eachNode] of eachNodes) {
                                    eachNode.remove()
                                }
                                eachNodes.clear()
                                return
                            }

                            let i = 0, idx = 0, keys = new Set()
                            for (const value of values) {
                                const instanceChildClone = instanceChild.cloneNode(true)
                                const instanceGrandChildren = els(eachAttrValue, instanceChildClone)

                                const templateDataAddon = {
                                    [caseConvert("kebab", "camel", eachAttrProp)]: '',
                                    [caseConvert("kebab", "camel", indexAttrProp)]: -1
                                }

                                const instanceDataAddon = {
                                    [caseConvert("kebab", "camel", eachAttrProp)]: value,
                                    [caseConvert("kebab", "camel", indexAttrProp)]: idx
                                }

                                const _templateData = Object.assign(
                                    Object.create(null),
                                    templateData,
                                    templateDataAddon,
                                )

                                const _instanceData = Object.assign(
                                    Object.create(null),
                                    instanceData,
                                    instanceDataAddon,
                                )

                                for (const templateAttr_pascalCase of templateAttributes) {
                                    const templateAttribute = {
                                        pascalCase: templateAttr_pascalCase,
                                        camelCase: caseConvert("pascal", "camel", templateAttr_pascalCase),
                                        kebabCase: caseConvert("pascal", "kebab", templateAttr_pascalCase),
                                    }

                                    const interpolationArgs = [
                                        context, templateElement, templateAttribute, instanceChildClone,
                                        _templateData, instanceElement, _instanceData
                                    ]

                                    interpolateAttributes(...interpolationArgs)
                                }

                                if (indexAttrValue) {
                                    const instanceGrandChildren = els(indexAttrValue, instanceChildClone)
                                    for (const instanceGrandChild of instanceGrandChildren) {
                                        instanceGrandChild.replaceWith(idx)
                                    }
                                }

                                for (const instanceGrandChild of instanceGrandChildren) {
                                    instanceGrandChild.replaceWith(value)
                                }

                                for (const instanceGrandChild of [...instanceChildClone.childNodes]) {
                                    const key = instanceGrandChild[KEY] = keyExtractor(value, i, values)
                                    eachNodes.get(key)?.remove()
                                    keys.add(key)

                                    eachNodes.set(key, instanceGrandChild)
                                    instanceChildParent.insertBefore(
                                        instanceGrandChild,
                                        instanceChildParent.childNodes[childIdx + i] ?? null
                                    )
                                    i++
                                }

                                idx++
                            }

                            for (const [key, eachNode] of eachNodes) {
                                if (!keys.has(key)) {
                                    eachNode.remove()
                                    eachNodes.delete(key)
                                }
                            }
                        }
                    )
                }
            )

            instanceChild.remove()
            isInitial = false
            continue
        }

        let textNodes = []
        executor(instanceElement, "when-nodes", whenProp, whenCondition)(
            function (show) {
                show = negated ? !show : show

                executor(instanceElement, "text-nodes", prop, instanceData[prop])(
                    function (text) {
                        if (!isInitial && instanceChildParent instanceof DocumentFragment)
                            instanceChildParent = instanceElement

                        for (const textNode of textNodes)
                            textNode.remove()
                        textNodes = []
                        if (!show) return

                        const textNode = document.createTextNode(text)
                        textNodes.push(textNode)
                        instanceChildParent.insertBefore(textNode, instanceChildParent.childNodes[childIdx])
                    }
                )
            }
        )

        instanceChild.remove()
        isInitial = false
    }
}

/**
 * @param {HTMLElement} element
 * @param {ReactiveType} reactiveType
 * @param {string} prop
 * @param {any} value
 */
function executor(element, reactiveType, prop, value) {
    let reactiveEvents = []
    reactiveEvents = element._reactiveEvents.get(reactiveType)
        ?? (element._reactiveEvents.set(reactiveType, reactiveEvents), reactiveEvents)

    const maybePushReactiveEvent = (fn) =>
        !reactiveEvents.some(([p]) => p === prop) && reactiveEvents.push([prop, fn])

    const callback = !(value && value instanceof Signal)
        ? fn => (maybePushReactiveEvent(fn), fn(value))
        : fn => (maybePushReactiveEvent(fn), $effect(() => fn(value.value)))

    return callback
}

/**
 * @typedef {
 *   "this-attr" | "event-attr" | "js-attr" | "html-attr" | "whence-nodes" | "when-nodes" | "each-nodes" | "text-nodes"} ReactiveType
 */