import {Router, render} from 'core/runtime'

const router = new Router()

router.get('/', () => render('home'))

export default router