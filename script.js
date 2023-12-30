import tempearly, { $signal, $computed, $props } from "./index.js"

const todos = $signal([])
const todoList = tempearly.new({
    template: "todo-list",
    props: {
        todos,
        todoEntryField: null,
        todoEntryIdxField: null,
        todoCount: $computed(() => todos.value.length),
        createTodo(evt) {
            evt.preventDefault()
            const form = evt.target
            const formData = new FormData(form)

            const todo = formData.get("todo-entry-field").trim()
            const idx = formData.get("todo-entry-idx")

            if (!todo) return

            todos.value = todos => (todos.splice(idx, 0, todo), todos)
            const { todoEntryIdxField } = $props(todoList)

            form.reset()
            todoEntryIdxField.value = todos.value.length
        },
        editTodo(evt) {
            evt.preventDefault()
            const idx = evt.target.dataset.idx

            const todo = todos.value[idx]
            todos.value = todos => (todos.splice(idx, 1), todos)

            const { todoEntryField, todoEntryIdxField } = $props(todoList)
            todoEntryField.value = todo
            todoEntryIdxField.value = idx
        },
        removeTodo(evt) {
            evt.preventDefault()
            const idx = evt.target.dataset.idx
            todos.value = todos => (todos.splice(idx, 1), todos)
        }
    },
})